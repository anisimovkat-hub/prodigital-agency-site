-- Цели кампаний, настройки целей проекта и курсы валют ЦБ для общей сводки.

-- На что оптимизирована кампания (Meta: из групп объявлений), например
-- "LEAD_GENERATION", "OFFSITE_CONVERSIONS:PURCHASE", "OFFSITE_CONVERSIONS:custom:123".
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS optimization_goal text;

-- Курс ЦБ РФ: сколько рублей стоит единица валюты в дату. Публичные данные.
CREATE TABLE public.fx_rates (
  date date NOT NULL,
  currency text NOT NULL,
  rub_per_unit numeric NOT NULL CHECK (rub_per_unit > 0),
  PRIMARY KEY (date, currency)
);
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fx_rates read" ON public.fx_rates FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.fx_rates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fx_rates TO service_role;

-- Как показывать цели в проекте: своё название, скрытие, дополнительная цель.
CREATE TABLE public.project_ad_goal_settings (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  goal_key text NOT NULL,
  label text,
  hidden boolean NOT NULL DEFAULT false,
  extra boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, goal_key)
);
ALTER TABLE public.project_ad_goal_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_ad_goal_settings admin" ON public.project_ad_goal_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "project_ad_goal_settings member read" ON public.project_ad_goal_settings FOR SELECT TO authenticated USING (public.is_project_member(project_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_ad_goal_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_ad_goal_settings TO service_role;
