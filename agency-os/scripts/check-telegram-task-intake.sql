-- Run after 0049. Test records are isolated and rolled back. No Telegram calls.
BEGIN;
DO $check$
DECLARE
  project_id uuid;
  staff_id uuid;
  owner_id uuid;
  owner_chat text;
  intake_id uuid;
  task_id uuid;
  again_id uuid;
  draft_id uuid;
  visible_count integer;
BEGIN
  SELECT id INTO STRICT owner_id FROM public.profiles WHERE role='owner' AND is_active;
  SELECT id INTO STRICT staff_id FROM public.profiles WHERE role='specialist' AND is_active AND NOT is_manual ORDER BY full_name LIMIT 1;
  SELECT id INTO STRICT project_id FROM public.projects WHERE stage='active' ORDER BY name LIMIT 1;
  SELECT setting_value INTO STRICT owner_chat FROM public.telegram_bot_settings WHERE setting_key='owner_chat_id';
  INSERT INTO public.telegram_task_intakes(chat_id,source_message_id,message_ids,items)
  VALUES(owner_chat,-94949,ARRAY[-94949]::bigint[],jsonb_build_array(jsonb_build_object(
    'source','__JARVIS_ROLLBACK_CHECK__','title','__JARVIS_ROLLBACK_CHECK__','projectId',project_id,
    'assigneeId',staff_id,'dueDate',NULL,'deadlineKnown',true))) RETURNING id INTO intake_id;
  task_id:=public.commit_telegram_intake_item(intake_id,0);
  again_id:=public.commit_telegram_intake_item(intake_id,0);
  IF task_id<>again_id THEN RAISE EXCEPTION 'Duplicate intake created a second task'; END IF;
  UPDATE public.telegram_task_intakes SET pending_field='deadline' WHERE id=intake_id;
  PERFORM public.apply_telegram_intake_reply(intake_id,-94950,0,(SELECT items FROM public.telegram_task_intakes WHERE id=intake_id));
  UPDATE public.telegram_task_intakes SET status='complete' WHERE id=intake_id;
  IF public.start_telegram_task_intake(owner_chat,-94950,'[{}]'::jsonb,NULL)<>intake_id THEN
    RAISE EXCEPTION 'A retried clarification reply became a new task session';
  END IF;
  UPDATE public.telegram_task_intakes SET status='pending' WHERE id=intake_id;
  IF NOT EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=task_id AND t.creator_id=owner_id AND t.owner_approval_pending AND t.status='todo') THEN
    RAISE EXCEPTION 'Invalid initial task state';
  END IF;
  PERFORM set_config('request.jwt.claim.sub',staff_id::text,true);
  IF public.can_access_task(task_id) THEN RAISE EXCEPTION 'Unapproved task is visible to staff through access function'; END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO visible_count FROM public.tasks t WHERE t.id=task_id;
  IF visible_count<>0 THEN RAISE EXCEPTION 'Unapproved task is visible under RLS'; END IF;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO visible_count FROM public.tasks t WHERE t.id=task_id;
  IF visible_count<>1 THEN RAISE EXCEPTION 'Owner cannot see draft task'; END IF;
  EXECUTE 'RESET ROLE';
  IF has_function_privilege('authenticated','public.commit_telegram_intake_item(uuid,integer)','EXECUTE')
    OR has_function_privilege('anon','public.commit_telegram_intake_item(uuid,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'Privileged intake RPC is publicly executable';
  END IF;
  INSERT INTO public.telegram_task_drafts(task_id,source_date,recipient_profile_id,recipient_chat_id,message_text,review_chat_id,expires_at)
    VALUES(task_id,current_date,staff_id,NULL,'__JARVIS_ROLLBACK_CHECK__',owner_chat,now()+interval '24 hours') RETURNING id INTO draft_id;
  IF NOT public.cancel_telegram_task_draft(draft_id,owner_chat) THEN RAISE EXCEPTION 'Cancellation failed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=task_id AND t.status='cancelled' AND t.owner_approval_pending) THEN RAISE EXCEPTION 'Cancelled draft leaked to staff'; END IF;
  UPDATE public.telegram_task_drafts SET status='pending_approval',expires_at=now()-interval '1 minute' WHERE id=draft_id;
  UPDATE public.tasks SET status='todo' WHERE id=task_id;
  PERFORM public.expire_telegram_intake_drafts();
  IF NOT EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=task_id AND t.status='cancelled') THEN RAISE EXCEPTION '24 hour expiry failed'; END IF;
  UPDATE public.tasks SET status='todo' WHERE id=task_id;
  UPDATE public.telegram_task_drafts SET status='pending_approval',expires_at=now()+interval '24 hours' WHERE id=draft_id;
  IF public.claim_telegram_task_delivery(draft_id,owner_chat)<>'claimed' THEN RAISE EXCEPTION 'Send claim failed'; END IF;
  IF public.claim_telegram_task_delivery(draft_id,owner_chat)='claimed' THEN RAISE EXCEPTION 'Double send claim'; END IF;
  IF public.cancel_telegram_task_draft(draft_id,owner_chat) THEN RAISE EXCEPTION 'Sending draft was cancelled concurrently'; END IF;
  IF NOT public.complete_telegram_task_delivery(draft_id,'test-only-chat',1) THEN RAISE EXCEPTION 'Delivery completion failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=task_id AND t.owner_approval_pending) THEN RAISE EXCEPTION 'Approved task stayed hidden'; END IF;
  IF public.complete_telegram_task_delivery(draft_id,'test-only-chat',1) THEN RAISE EXCEPTION 'Completion was claimed twice'; END IF;
  INSERT INTO public.tasks(project_id,assignee_id,creator_id,title,status,owner_approval_pending,created_at)
    VALUES(project_id,staff_id,owner_id,'__JARVIS_ORPHAN_ROLLBACK_CHECK__','todo',true,now()-interval '25 hours') RETURNING id INTO task_id;
  PERFORM public.expire_telegram_intake_drafts();
  IF NOT EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=task_id AND t.status='cancelled' AND t.owner_approval_pending) THEN
    RAISE EXCEPTION 'A task without a delivered owner preview did not expire';
  END IF;
END;
$check$;
ROLLBACK;
SELECT 'PASS: idempotency, creator, staff RLS, owner access, RPC grants, cancellation, expiry, delivery claim; all test rows rolled back' AS result;
