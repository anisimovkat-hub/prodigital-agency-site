-- A reply message must not become a second task if Telegram retries it after
-- the clarification session has already completed.
BEGIN;
CREATE TABLE public.telegram_intake_messages (
  chat_id text NOT NULL,
  message_id bigint NOT NULL,
  intake_id uuid NOT NULL REFERENCES public.telegram_task_intakes(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(chat_id,message_id)
);
ALTER TABLE public.telegram_intake_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads intake receipts" ON public.telegram_intake_messages FOR SELECT TO authenticated USING(public.is_admin());
REVOKE ALL ON public.telegram_intake_messages FROM anon,authenticated;
GRANT SELECT ON public.telegram_intake_messages TO authenticated;
GRANT ALL ON public.telegram_intake_messages TO service_role;

CREATE FUNCTION public.start_telegram_task_intake(p_chat_id text,p_message_id bigint,p_items jsonb,p_edit_draft_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE result uuid;
BEGIN
  IF p_chat_id IS DISTINCT FROM (SELECT setting_value FROM public.telegram_bot_settings WHERE setting_key='owner_chat_id') THEN RAISE EXCEPTION 'Owner mismatch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_chat_id,0));
  SELECT intake_id INTO result FROM public.telegram_intake_messages WHERE chat_id=p_chat_id AND message_id=p_message_id;
  IF FOUND THEN RETURN result; END IF;
  INSERT INTO public.telegram_task_intakes(chat_id,source_message_id,message_ids,items,edit_draft_id)
    VALUES(p_chat_id,p_message_id,ARRAY[p_message_id],p_items,p_edit_draft_id) RETURNING id INTO result;
  INSERT INTO public.telegram_intake_messages(chat_id,message_id,intake_id) VALUES(p_chat_id,p_message_id,result);
  RETURN result;
END;
$$;

CREATE FUNCTION public.apply_telegram_intake_reply(p_intake_id uuid,p_message_id bigint,p_revision integer,p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE intake public.telegram_task_intakes%ROWTYPE; result uuid;
BEGIN
  SELECT * INTO STRICT intake FROM public.telegram_task_intakes WHERE id=p_intake_id;
  IF intake.chat_id IS DISTINCT FROM (SELECT setting_value FROM public.telegram_bot_settings WHERE setting_key='owner_chat_id') THEN RAISE EXCEPTION 'Owner mismatch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(intake.chat_id,0));
  SELECT intake_id INTO result FROM public.telegram_intake_messages WHERE chat_id=intake.chat_id AND message_id=p_message_id;
  IF FOUND THEN RETURN result; END IF;
  SELECT * INTO STRICT intake FROM public.telegram_task_intakes WHERE id=p_intake_id FOR UPDATE;
  IF intake.status<>'pending' OR intake.revision<>p_revision OR intake.pending_field IS NULL THEN RETURN NULL; END IF;
  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)<>jsonb_array_length(intake.items) THEN RAISE EXCEPTION 'Invalid reply'; END IF;
  UPDATE public.telegram_task_intakes SET items=p_items,pending_field=NULL,choices='[]',revision=revision+1,
    message_ids=array_append(message_ids,p_message_id),updated_at=now() WHERE id=p_intake_id;
  INSERT INTO public.telegram_intake_messages(chat_id,message_id,intake_id) VALUES(intake.chat_id,p_message_id,p_intake_id);
  RETURN p_intake_id;
END;
$$;
REVOKE ALL ON FUNCTION public.start_telegram_task_intake(text,bigint,jsonb,uuid),public.apply_telegram_intake_reply(uuid,bigint,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_telegram_task_intake(text,bigint,jsonb,uuid),public.apply_telegram_intake_reply(uuid,bigint,integer,jsonb) TO service_role;
COMMIT;
