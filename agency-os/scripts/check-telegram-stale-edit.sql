-- Prepared, NOT EXECUTED. Run only after reviewing/approving 0052 or in an
-- explicitly authorized transaction with its candidate function installed.
-- Fixtures use existing identities only as FK references. No real tasks,
-- settings, messages or project statuses are updated. Everything rolls back.
BEGIN;
DO $check$
DECLARE
  v_owner uuid; v_staff uuid; v_chat text;
  v_active uuid; v_original_project uuid; v_old uuid; v_draft uuid; v_intake uuid; v_result uuid;
  v_before jsonb; v_after jsonb; v_items jsonb;
  v_case integer:=0; v_status text; v_stage text;
BEGIN
  SELECT id INTO STRICT v_owner FROM public.profiles WHERE role='owner' AND is_active IS TRUE;
  SELECT id INTO STRICT v_staff FROM public.profiles WHERE role='specialist' AND is_active IS TRUE ORDER BY full_name LIMIT 1;
  SELECT setting_value INTO STRICT v_chat FROM public.telegram_bot_settings WHERE setting_key='owner_chat_id';
  INSERT INTO public.projects(name,stage) VALUES('__JARVIS_0052_TARGET__','active') RETURNING id INTO v_active;

  FOR v_case IN 1..5 LOOP
    v_status:=CASE v_case WHEN 1 THEN 'paused' WHEN 2 THEN 'done' WHEN 3 THEN 'cancelled' ELSE 'todo' END;
    v_stage:=CASE v_case WHEN 4 THEN 'paused' WHEN 5 THEN 'finished' ELSE 'active' END;
    -- Insert after the project already has its stage: a stale todo row in a
    -- closed project exercises the original-project predicate independently.
    INSERT INTO public.projects(name,stage) VALUES('__JARVIS_0052_ORIGINAL__',v_stage::public.project_stage) RETURNING id INTO v_original_project;
    INSERT INTO public.tasks(project_id,assignee_id,creator_id,title,description,due_date,status,priority,owner_approval_pending)
      VALUES(v_original_project,v_staff,v_owner,'__JARVIS_0052_KEEP__','__KEEP_DESCRIPTION__',current_date-10,v_status::public.task_status,'high',false)
      RETURNING id INTO v_old;
    INSERT INTO public.telegram_task_drafts(task_id,source_date,recipient_profile_id,message_text,review_chat_id,status,expires_at)
      VALUES(v_old,current_date-10,v_staff,'__KEEP_SNAPSHOT__',v_chat,'editing',NULL) RETURNING id INTO v_draft;
    v_items:=jsonb_build_array(jsonb_build_object('source','__OFFLINE_FIXTURE__','title','__MUST_NOT_OVERWRITE__',
      'projectId',v_active,'assigneeId',v_staff,'dueDate',current_date+1,'deadlineKnown',true));
    INSERT INTO public.telegram_task_intakes(chat_id,source_message_id,items,edit_draft_id)
      VALUES(v_chat,-95200-v_case,v_items,v_draft) RETURNING id INTO v_intake;
    SELECT to_jsonb(t) INTO v_before FROM public.tasks t WHERE id=v_old;
    BEGIN
      PERFORM public.commit_telegram_intake_item(v_intake,0);
      RAISE EXCEPTION 'CHECK: stale edit unexpectedly accepted';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'Editing task is not operational' THEN RAISE; END IF;
    END;
    SELECT to_jsonb(t) INTO v_after FROM public.tasks t WHERE id=v_old;
    IF v_after IS DISTINCT FROM v_before THEN RAISE EXCEPTION 'CHECK: old task was changed'; END IF;
    IF (SELECT items FROM public.telegram_task_intakes WHERE id=v_intake) IS DISTINCT FROM v_items THEN
      RAISE EXCEPTION 'CHECK: failed edit persisted a taskId';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.telegram_task_drafts WHERE id=v_draft AND status='editing' AND message_text='__KEEP_SNAPSHOT__') THEN
      RAISE EXCEPTION 'CHECK: SQL guard modified the draft';
    END IF;
  END LOOP;

  -- An active edit still edits the same task and preserves status/priority.
  INSERT INTO public.tasks(project_id,assignee_id,creator_id,title,status,priority,owner_approval_pending)
    VALUES(v_active,v_staff,v_owner,'__JARVIS_0052_ACTIVE__','todo','high',false) RETURNING id INTO v_old;
  INSERT INTO public.telegram_task_drafts(task_id,source_date,recipient_profile_id,message_text,review_chat_id,status)
    VALUES(v_old,current_date,v_staff,'__ACTIVE_SNAPSHOT__',v_chat,'editing') RETURNING id INTO v_draft;
  v_items:=jsonb_build_array(jsonb_build_object('source','__OFFLINE_FIXTURE__','title','__ACTIVE_EDIT__',
    'projectId',v_active,'assigneeId',v_staff,'dueDate',current_date+1,'deadlineKnown',true));
  INSERT INTO public.telegram_task_intakes(chat_id,source_message_id,items,edit_draft_id)
    VALUES(v_chat,-95206,v_items,v_draft) RETURNING id INTO v_intake;
  v_result:=public.commit_telegram_intake_item(v_intake,0);
  IF v_result IS DISTINCT FROM v_old OR public.commit_telegram_intake_item(v_intake,0) IS DISTINCT FROM v_old THEN
    RAISE EXCEPTION 'CHECK: active edit retry was not idempotent';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.tasks WHERE id=v_old AND title='__ACTIVE_EDIT__' AND status='todo' AND priority='high' AND NOT owner_approval_pending) THEN
    RAISE EXCEPTION 'CHECK: active edit behavior changed';
  END IF;

  -- Normal new intake keeps todo/private approval and owner creator.
  INSERT INTO public.telegram_task_intakes(chat_id,source_message_id,items)
    VALUES(v_chat,-95207,v_items) RETURNING id INTO v_intake;
  v_result:=public.commit_telegram_intake_item(v_intake,0);
  IF v_result=v_old OR NOT EXISTS(SELECT 1 FROM public.tasks WHERE id=v_result AND creator_id=v_owner AND assignee_id=v_staff
      AND status='todo' AND priority='medium' AND owner_approval_pending) THEN
    RAISE EXCEPTION 'CHECK: new intake behavior changed';
  END IF;
  IF has_function_privilege('anon','public.commit_telegram_intake_item(uuid,integer)','EXECUTE')
      OR has_function_privilege('authenticated','public.commit_telegram_intake_item(uuid,integer)','EXECUTE')
      OR NOT has_function_privilege('service_role','public.commit_telegram_intake_item(uuid,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'CHECK: RPC permissions changed';
  END IF;
END;
$check$;
ROLLBACK;
SELECT 'PASS: stale task/project edits refused without changes; active edit/new intake/idempotence/grants preserved; all fixture rows rolled back' AS result;
