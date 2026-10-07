-- Configurable weekly advertising statuses. The bot reads only normalized Agency OS rows.
CREATE TABLE public.telegram_weekly_status_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 140),
  channel text NOT NULL CHECK (length(channel) BETWEEN 1 AND 80),
  recipient_chat_id text NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Moscow',
  schedule text NOT NULL DEFAULT '0 7 * * 1',
  template_key text NOT NULL DEFAULT 'project_weekly_ad_status',
  report_url text,
  fallback_source jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

CREATE TABLE public.telegram_weekly_status_directions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.telegram_weekly_status_scenarios(id) ON DELETE CASCADE,
  project_direction_id uuid REFERENCES public.project_ad_directions(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  channel text NOT NULL CHECK (length(channel) BETWEEN 1 AND 80),
  counter_id text NOT NULL CHECK (counter_id ~ '^[1-9][0-9]*$'),
  fallback_match jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(scenario_id, counter_id)
);

CREATE TABLE public.telegram_weekly_status_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction_id uuid NOT NULL REFERENCES public.telegram_weekly_status_directions(id) ON DELETE CASCADE,
  goal_id text NOT NULL CHECK (goal_id ~ '^[1-9][0-9]*$'),
  action_type text NOT NULL CHECK (action_type ~ '^yandex_goal:[1-9][0-9]*:LC$'),
  business_label text NOT NULL CHECK (length(business_label) BETWEEN 1 AND 100),
  metric_kind text NOT NULL CHECK (metric_kind IN ('cart', 'purchase', 'phone', 'messenger', 'form')),
  value_label text,
  include_in_contact_cpa boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(direction_id, goal_id)
);

CREATE TABLE public.telegram_weekly_status_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.telegram_weekly_status_scenarios(id) ON DELETE CASCADE,
  period_from date NOT NULL,
  period_to date NOT NULL,
  message_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'blocked')),
  sent_at timestamptz,
  sent_message_id bigint,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_from <= period_to),
  UNIQUE(scenario_id, period_from, period_to)
);

ALTER TABLE public.ad_campaign_metrics ADD COLUMN IF NOT EXISTS spend_includes_vat boolean NOT NULL DEFAULT false;
ALTER TABLE public.ad_conversions ADD COLUMN IF NOT EXISTS value_is_measured boolean NOT NULL DEFAULT false;

CREATE INDEX telegram_weekly_status_scenarios_active_idx ON public.telegram_weekly_status_scenarios(is_active);
CREATE INDEX telegram_weekly_status_deliveries_due_idx ON public.telegram_weekly_status_deliveries(status, period_to);
CREATE INDEX telegram_weekly_status_directions_scenario_idx ON public.telegram_weekly_status_directions(scenario_id) WHERE is_active;
CREATE INDEX telegram_weekly_status_goals_direction_idx ON public.telegram_weekly_status_goals(direction_id) WHERE is_active;

ALTER TABLE public.telegram_weekly_status_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_weekly_status_directions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_weekly_status_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_weekly_status_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages weekly status scenarios" ON public.telegram_weekly_status_scenarios FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin manages weekly status directions" ON public.telegram_weekly_status_directions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin manages weekly status goals" ON public.telegram_weekly_status_goals FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin manages weekly status deliveries" ON public.telegram_weekly_status_deliveries FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_weekly_status_scenarios TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_weekly_status_directions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_weekly_status_goals TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_weekly_status_deliveries TO authenticated, service_role;
