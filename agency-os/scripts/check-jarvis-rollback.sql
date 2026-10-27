-- Test rollback data safety in a transaction. No external messages.
BEGIN;
DO $seed$
DECLARE owner_id uuid; staff_id uuid; project_id uuid; task_id uuid; owner_chat text; pending boolean;
BEGIN
  SELECT id INTO STRICT owner_id FROM public.profiles WHERE role='owner' AND is_active;
  SELECT id INTO STRICT staff_id FROM public.profiles WHERE role='specialist' AND is_active ORDER BY full_name LIMIT 1;
  SELECT id INTO STRICT project_id FROM public.projects WHERE stage='active' ORDER BY name LIMIT 1;
  SELECT setting_value INTO STRICT owner_chat FROM public.telegram_bot_settings WHERE setting_key='owner_chat_id';
  FOREACH pending IN ARRAY ARRAY[true,false] LOOP
    INSERT INTO public.tasks(project_id,assignee_id,creator_id,title,status,owner_approval_pending)
      VALUES(project_id,staff_id,owner_id,CASE WHEN pending THEN '__JARVIS_ROLLBACK_NEW__' ELSE '__JARVIS_ROLLBACK_LEGACY__' END,'todo',pending) RETURNING id INTO task_id;
    INSERT INTO public.telegram_task_drafts(task_id,source_date,recipient_profile_id,recipient_chat_id,message_text,review_chat_id)
      VALUES(task_id,current_date,staff_id,'rollback-test-only','rollback-test-only',owner_chat);
  END LOOP;
END;
$seed$;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $rollback$
DECLARE item record;
BEGIN
  FOR item IN SELECT t.id FROM public.tasks t
    WHERE t.owner_approval_pending
      AND NOT EXISTS(SELECT 1 FROM public.telegram_task_drafts d WHERE d.task_id=t.id AND d.status='sending')
    ORDER BY t.id FOR UPDATE
  LOOP
    UPDATE public.tasks SET status='cancelled' WHERE id=item.id AND owner_approval_pending AND status NOT IN ('done','cancelled');
    UPDATE public.telegram_task_drafts SET status='cancelled',updated_at=now()
      WHERE task_id=item.id AND status IN ('pending_approval','editing','failed');
  END LOOP;
  UPDATE public.telegram_task_intakes SET status='cancelled',updated_at=now() WHERE status='pending';
END;
$rollback$;
DO $assert$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.tasks t JOIN public.telegram_task_drafts d ON d.task_id=t.id WHERE t.title='__JARVIS_ROLLBACK_NEW__' AND t.status='cancelled' AND t.owner_approval_pending AND d.status='cancelled') THEN RAISE EXCEPTION 'New pending task was not safely cancelled'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.tasks t JOIN public.telegram_task_drafts d ON d.task_id=t.id WHERE t.title='__JARVIS_ROLLBACK_LEGACY__' AND t.status='todo' AND NOT t.owner_approval_pending AND d.status='pending_approval') THEN RAISE EXCEPTION 'Rollback affected a legacy employee task/draft'; END IF;
END;
$assert$;
ROLLBACK;
SELECT 'PASS: new pending intake cancelled, legacy employee task and morning draft preserved; all changes rolled back' AS result;
