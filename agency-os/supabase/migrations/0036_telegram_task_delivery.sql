-- CRM-driven Telegram task delivery. Nothing here reads from Notion.

CREATE TABLE public.telegram_bot_settings (
  setting_key text PRIMARY KEY,
  setting_value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.telegram_chat_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL UNIQUE,
  chat_title text,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.telegram_task_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  source_date date NOT NULL,
  recipient_chat_id text NOT NULL,
  recipient_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  message_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'editing', 'sent', 'cancelled', 'failed')),
  review_chat_id text,
  review_message_id bigint,
  recipient_message_id bigint,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, source_date)
);

CREATE INDEX telegram_task_drafts_status_idx ON public.telegram_task_drafts (status, source_date);
CREATE INDEX telegram_chat_bindings_profile_idx ON public.telegram_chat_bindings (profile_id) WHERE is_active;

ALTER TABLE public.telegram_bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_chat_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_task_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages telegram bot settings" ON public.telegram_bot_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin manages telegram chat bindings" ON public.telegram_chat_bindings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin manages telegram task drafts" ON public.telegram_task_drafts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Create tomorrow's recurring tasks as well: this gives the owner a full day to approve
-- the Telegram reminder, while the task itself keeps tomorrow as its due date.
CREATE OR REPLACE FUNCTION public.generate_recurring_tasks_window()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN public.generate_recurring_tasks(current_date)
       + public.generate_recurring_tasks(current_date + 1);
END;
$$;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'generate-recurring-tasks';

SELECT cron.schedule(
  'generate-recurring-tasks',
  '0 3 * * *',
  $$SELECT public.generate_recurring_tasks_window();$$
);
