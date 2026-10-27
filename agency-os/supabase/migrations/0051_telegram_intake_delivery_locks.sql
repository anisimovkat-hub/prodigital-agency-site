-- Use the same task -> draft lock order for send/cancel/expiry. Expire even
-- tasks whose owner preview failed before its draft row could be saved.
BEGIN;
CREATE FUNCTION public.claim_telegram_task_delivery(p_draft_id uuid,p_owner_chat_id text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE draft public.telegram_task_drafts%ROWTYPE; task public.tasks%ROWTYPE; target uuid;
BEGIN
  IF p_owner_chat_id IS DISTINCT FROM (SELECT setting_value FROM public.telegram_bot_settings WHERE setting_key='owner_chat_id') THEN RAISE EXCEPTION 'Owner mismatch'; END IF;
  SELECT task_id INTO target FROM public.telegram_task_drafts WHERE id=p_draft_id AND review_chat_id=p_owner_chat_id;
  IF NOT FOUND THEN RETURN 'missing'; END IF;
  SELECT * INTO STRICT task FROM public.tasks WHERE id=target FOR UPDATE;
  SELECT * INTO STRICT draft FROM public.telegram_task_drafts WHERE id=p_draft_id FOR UPDATE;
  IF draft.status NOT IN ('pending_approval','failed') THEN RETURN draft.status; END IF;
  IF (draft.expires_at IS NOT NULL AND draft.expires_at<=now()) OR (task.owner_approval_pending AND task.created_at<=now()-interval '24 hours') THEN
    UPDATE public.telegram_task_drafts SET status='cancelled',updated_at=now() WHERE id=draft.id;
    UPDATE public.tasks SET status='cancelled' WHERE id=task.id AND owner_approval_pending;
    RETURN 'expired';
  END IF;
  IF task.status IN ('done','cancelled','paused') OR task.assignee_id IS NULL THEN RETURN 'inactive'; END IF;
  IF task.project_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.projects WHERE id=task.project_id AND stage IN ('active','launching')) THEN RETURN 'inactive'; END IF;
  IF task.owner_approval_pending AND EXISTS(SELECT 1 FROM public.telegram_task_drafts WHERE task_id=task.id AND id<>draft.id AND status IN ('sending','sent')) THEN RETURN 'sending'; END IF;
  UPDATE public.telegram_task_drafts SET status='sending',updated_at=now() WHERE id=draft.id;
  RETURN 'claimed';
END;
$$;
REVOKE ALL ON FUNCTION public.claim_telegram_task_delivery(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_telegram_task_delivery(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_telegram_task_draft(p_draft_id uuid,p_owner_chat_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE draft public.telegram_task_drafts%ROWTYPE; target uuid;
BEGIN
  IF p_owner_chat_id IS DISTINCT FROM (SELECT setting_value FROM public.telegram_bot_settings WHERE setting_key='owner_chat_id') THEN RAISE EXCEPTION 'Owner mismatch'; END IF;
  SELECT task_id INTO target FROM public.telegram_task_drafts WHERE id=p_draft_id AND review_chat_id=p_owner_chat_id;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM public.tasks WHERE id=target FOR UPDATE;
  SELECT * INTO draft FROM public.telegram_task_drafts WHERE id=p_draft_id FOR UPDATE;
  IF draft.status NOT IN ('pending_approval','editing','failed') THEN RETURN false; END IF;
  UPDATE public.telegram_task_drafts SET status='cancelled',updated_at=now() WHERE id=draft.id;
  UPDATE public.tasks SET status='cancelled' WHERE id=target AND owner_approval_pending;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_telegram_task_delivery(p_draft_id uuid,p_recipient_chat_id text,p_message_id bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE draft public.telegram_task_drafts%ROWTYPE; target uuid;
BEGIN
  SELECT task_id INTO target FROM public.telegram_task_drafts WHERE id=p_draft_id;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM public.tasks WHERE id=target FOR UPDATE;
  SELECT * INTO draft FROM public.telegram_task_drafts WHERE id=p_draft_id FOR UPDATE;
  IF draft.status<>'sending' THEN RETURN false; END IF;
  UPDATE public.tasks SET owner_approval_pending=false WHERE id=target;
  UPDATE public.telegram_task_drafts SET status='sent',recipient_chat_id=p_recipient_chat_id,recipient_message_id=p_message_id,last_error=NULL,updated_at=now() WHERE id=draft.id;
  UPDATE public.telegram_task_drafts SET status='cancelled',updated_at=now() WHERE task_id=target AND id<>draft.id AND status IN ('pending_approval','editing','failed');
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_telegram_intake_drafts()
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE n integer;
BEGIN
  WITH expired AS (
    UPDATE public.tasks t SET status='cancelled'
    WHERE t.owner_approval_pending AND t.status NOT IN ('done','cancelled')
      AND (t.created_at<=now()-interval '24 hours' OR EXISTS(SELECT 1 FROM public.telegram_task_drafts d WHERE d.task_id=t.id AND d.expires_at<=now()))
      AND NOT EXISTS(SELECT 1 FROM public.telegram_task_drafts d WHERE d.task_id=t.id AND d.status='sending')
    RETURNING t.id
  ) UPDATE public.telegram_task_drafts SET status='cancelled',updated_at=now()
    WHERE task_id IN (SELECT id FROM expired) AND status IN ('pending_approval','editing','failed');
  GET DIAGNOSTICS n=ROW_COUNT;
  UPDATE public.telegram_task_intakes SET status='cancelled',updated_at=now() WHERE status='pending'
    AND edit_draft_id IN (SELECT id FROM public.telegram_task_drafts WHERE status='cancelled');
  RETURN n;
END;
$$;
COMMIT;
