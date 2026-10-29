-- Prepared 2026-10-29. Apply only after explicit owner approval.
-- Replaces one existing function; no schema, grants, scheduling or task backfill.
-- CREATE OR REPLACE preserves the existing function ACL and SECURITY INVOKER.
BEGIN;
CREATE OR REPLACE FUNCTION public.commit_telegram_intake_item(p_intake_id uuid,p_index integer)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE
  intake public.telegram_task_intakes%ROWTYPE;
  item jsonb;
  owner_id uuid;
  task_id uuid;
  selected_project uuid;
  selected_assignee uuid;
  selected_date date;
  project_stage text;
BEGIN
  SELECT * INTO STRICT intake FROM public.telegram_task_intakes WHERE id=p_intake_id FOR UPDATE;
  IF intake.status<>'pending' OR p_index<>intake.current_index OR p_index<0 OR p_index>=jsonb_array_length(intake.items) THEN
    RAISE EXCEPTION 'Intake is not current';
  END IF;
  IF intake.chat_id IS DISTINCT FROM (SELECT setting_value FROM public.telegram_bot_settings WHERE setting_key='owner_chat_id') THEN
    RAISE EXCEPTION 'Owner mismatch';
  END IF;
  SELECT id INTO STRICT owner_id FROM public.profiles WHERE role='owner' AND is_active IS TRUE;
  item:=intake.items->p_index;
  IF item->>'taskId' IS NOT NULL THEN
    SELECT id INTO STRICT task_id FROM public.tasks WHERE id=(item->>'taskId')::uuid AND creator_id=owner_id;
    RETURN task_id;
  END IF;
  selected_project:=(item->>'projectId')::uuid;
  selected_assignee:=(item->>'assigneeId')::uuid;
  selected_date:=(item->>'dueDate')::date;
  IF selected_project IS NULL OR selected_assignee IS NULL OR coalesce((item->>'deadlineKnown')::boolean,false) IS NOT TRUE
     OR coalesce(length(btrim(item->>'title')),0) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Missing task fields';
  END IF;
  SELECT stage::text INTO STRICT project_stage FROM public.projects WHERE id=selected_project;
  IF project_stage IS NULL OR project_stage NOT IN ('active','launching') THEN RAISE EXCEPTION 'Project is inactive'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=selected_assignee AND is_active IS TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignee is inactive'; END IF;
  IF intake.edit_draft_id IS NOT NULL THEN
    SELECT d.task_id INTO STRICT task_id FROM public.telegram_task_drafts d
      WHERE d.id=intake.edit_draft_id AND d.review_chat_id=intake.chat_id AND d.status='editing' FOR UPDATE;
    -- Guard the original task/project in the UPDATE itself. A new project in
    -- the dictated edit must not resurrect or move stopped historical work.
    UPDATE public.tasks AS target
      SET project_id=selected_project,assignee_id=selected_assignee,due_date=selected_date,
          title=btrim(item->>'title'),description=nullif(item->>'description','')
      WHERE target.id=task_id
        AND target.status IS NOT NULL AND target.status NOT IN ('done','cancelled','paused')
        AND (target.project_id IS NULL OR EXISTS(
          SELECT 1 FROM public.projects original_project
          WHERE original_project.id=target.project_id AND original_project.stage IN ('active','launching')
        ))
      RETURNING target.id INTO task_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Editing task is not operational'; END IF;
  ELSE
    INSERT INTO public.tasks(project_id,assignee_id,creator_id,title,description,due_date,status,priority,task_type,owner_approval_pending)
      VALUES(selected_project,selected_assignee,owner_id,btrim(item->>'title'),nullif(item->>'description',''),selected_date,'todo','medium','other',true)
      RETURNING id INTO task_id;
  END IF;
  UPDATE public.telegram_task_intakes SET items=jsonb_set(items,ARRAY[p_index::text,'taskId'],to_jsonb(task_id::text)),updated_at=now() WHERE id=p_intake_id;
  RETURN task_id;
END;
$$;
COMMIT;
