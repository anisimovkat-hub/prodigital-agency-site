-- Additive intake storage; alias values are reviewed and filled separately.
BEGIN;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.tasks ADD COLUMN owner_approval_pending boolean NOT NULL DEFAULT false;
-- A pending intake task and all its related records are private to the owner.
CREATE OR REPLACE FUNCTION public.can_access_task(tid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=tid
    AND (NOT t.owner_approval_pending OR public.is_admin())
    AND (public.is_admin() OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id))
      OR t.assignee_id=auth.uid() OR (t.project_id IS NULL AND t.creator_id=auth.uid())));
$$;
CREATE POLICY "unapproved intake stays with owner" ON public.tasks AS RESTRICTIVE
  FOR ALL TO authenticated USING(NOT owner_approval_pending OR public.is_admin())
  WITH CHECK(NOT owner_approval_pending OR public.is_admin());

CREATE TABLE public.telegram_task_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  source_message_id bigint NOT NULL,
  message_ids bigint[] NOT NULL DEFAULT '{}',
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 20),
  current_index integer NOT NULL DEFAULT 0,
  revision integer NOT NULL DEFAULT 0,
  pending_field text CHECK (pending_field IN ('project','assignee','deadline','project_search','title')),
  choices jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(choices) = 'array'),
  edit_draft_id uuid REFERENCES public.telegram_task_drafts(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chat_id, source_message_id)
);
CREATE INDEX telegram_task_intakes_open_idx ON public.telegram_task_intakes(chat_id, updated_at DESC) WHERE status='pending';
CREATE INDEX telegram_task_intakes_messages_idx ON public.telegram_task_intakes USING gin(message_ids);

CREATE TABLE public.telegram_voice_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  source_message_id bigint NOT NULL,
  file_id text NOT NULL,
  file_unique_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','done','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chat_id,source_message_id)
);
ALTER TABLE public.telegram_task_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_voice_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads task intakes" ON public.telegram_task_intakes FOR SELECT TO authenticated USING(public.is_admin());
CREATE POLICY "owner reads queued voices" ON public.telegram_voice_queue FOR SELECT TO authenticated USING(public.is_admin());
-- Only the trusted webhook/service role mutates intake/voice state.
REVOKE ALL ON public.telegram_task_intakes,public.telegram_voice_queue FROM anon,authenticated;
GRANT SELECT ON public.telegram_task_intakes,public.telegram_voice_queue TO authenticated;
GRANT ALL ON public.telegram_task_intakes,public.telegram_voice_queue TO service_role;

ALTER TABLE public.telegram_task_drafts ALTER COLUMN recipient_chat_id DROP NOT NULL;
ALTER TABLE public.telegram_task_drafts ADD COLUMN expires_at timestamptz;
ALTER TABLE public.telegram_task_drafts DROP CONSTRAINT telegram_task_drafts_status_check;
ALTER TABLE public.telegram_task_drafts ADD CONSTRAINT telegram_task_drafts_status_check
  CHECK(status IN ('pending_approval','editing','sending','sent','cancelled','failed'));

-- Atomically creates/edits a CRM task and records its id in the locked intake.
-- A Telegram retry cannot create the same item twice. Identity is derived from
-- settings/profiles, never from a user-supplied creator UUID.
CREATE FUNCTION public.commit_telegram_intake_item(p_intake_id uuid,p_index integer)
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
    UPDATE public.tasks SET project_id=selected_project,assignee_id=selected_assignee,due_date=selected_date,
      title=btrim(item->>'title'),description=nullif(item->>'description','') WHERE id=task_id;
  ELSE
    INSERT INTO public.tasks(project_id,assignee_id,creator_id,title,description,due_date,status,priority,task_type,owner_approval_pending)
      VALUES(selected_project,selected_assignee,owner_id,btrim(item->>'title'),nullif(item->>'description',''),selected_date,'todo','medium','other',true)
      RETURNING id INTO task_id;
  END IF;
  UPDATE public.telegram_task_intakes SET items=jsonb_set(items,ARRAY[p_index::text,'taskId'],to_jsonb(task_id::text)),updated_at=now() WHERE id=p_intake_id;
  RETURN task_id;
END;
$$;
REVOKE ALL ON FUNCTION public.commit_telegram_intake_item(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_telegram_intake_item(uuid,integer) TO service_role;

CREATE FUNCTION public.cancel_telegram_task_draft(p_draft_id uuid,p_owner_chat_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE draft public.telegram_task_drafts%ROWTYPE;
BEGIN
  IF p_owner_chat_id IS DISTINCT FROM (SELECT setting_value FROM public.telegram_bot_settings WHERE setting_key='owner_chat_id') THEN RAISE EXCEPTION 'Owner mismatch'; END IF;
  SELECT * INTO draft FROM public.telegram_task_drafts WHERE id=p_draft_id AND review_chat_id=p_owner_chat_id FOR UPDATE;
  IF NOT FOUND OR draft.status NOT IN ('pending_approval','editing','failed') THEN RETURN false; END IF;
  UPDATE public.telegram_task_drafts SET status='cancelled',updated_at=now() WHERE id=draft.id;
  -- Existing morning reminders never cancel a task that already belongs to staff.
  UPDATE public.tasks SET status='cancelled' WHERE id=draft.task_id AND owner_approval_pending;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_telegram_task_draft(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_telegram_task_draft(uuid,text) TO service_role;

CREATE FUNCTION public.complete_telegram_task_delivery(p_draft_id uuid,p_recipient_chat_id text,p_message_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE draft public.telegram_task_drafts%ROWTYPE;
BEGIN
  SELECT * INTO draft FROM public.telegram_task_drafts WHERE id=p_draft_id AND status='sending' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.tasks SET owner_approval_pending=false WHERE id=draft.task_id;
  UPDATE public.telegram_task_drafts SET status='sent',recipient_chat_id=p_recipient_chat_id,
    recipient_message_id=p_message_id,last_error=NULL,updated_at=now() WHERE id=draft.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_telegram_task_delivery(uuid,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_telegram_task_delivery(uuid,text,bigint) TO service_role;

CREATE FUNCTION public.expire_telegram_intake_drafts()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE n integer;
BEGIN
  WITH expired AS (
    UPDATE public.telegram_task_drafts SET status='cancelled',updated_at=now()
    WHERE expires_at<=now() AND status IN ('pending_approval','editing','failed') RETURNING task_id
  ) UPDATE public.tasks SET status='cancelled' WHERE owner_approval_pending AND id IN (SELECT task_id FROM expired);
  GET DIAGNOSTICS n=ROW_COUNT;
  UPDATE public.telegram_task_intakes SET status='cancelled',updated_at=now() WHERE status='pending'
    AND edit_draft_id IN (SELECT id FROM public.telegram_task_drafts WHERE status='cancelled');
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_telegram_intake_drafts() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_telegram_intake_drafts() TO service_role;
-- Hourly Vercel limits do not affect expiry. The database checks every minute;
-- the webhook also expires due drafts before accepting a button click.
SELECT cron.schedule('expire-telegram-intake-drafts','* * * * *',$job$SELECT public.expire_telegram_intake_drafts();$job$);
COMMIT;
