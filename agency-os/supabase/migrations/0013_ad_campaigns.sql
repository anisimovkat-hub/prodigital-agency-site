-- Реклама, фаза A: кампании, суточные метрики кампаний и конверсии по всем целям.
-- ad_campaigns — кампании кабинета (Meta /act_X/campaigns). project_id по умолчанию
--   наследуется от кабинета, но может быть переопределён вручную: в одном кабинете
--   кампании нередко относятся к разным продуктам/проектам.
-- ad_campaign_metrics — суточные расход/показы/клики/охват по кампании
--   (insights level=campaign, time_increment=1). Account-level ad_metrics остаётся как есть.
-- ad_conversions — КАЖДЫЙ action_type из insights.actions отдельной строкой
--   (lead, messaging, purchase, pixel-специфичные и т.д.). Схлопывать в один «лид»
--   нельзя: у разных кампаний разные цели и разные пиксели, «главную» цель выбирает UI.
-- Токен Meta хранится ТОЛЬКО в sensitive env Vercel META_ACCESS_TOKEN, в БД и Git его нет.
-- Доступ: только владелец (is_admin), как в 0011.

CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text,
  objective text,
  status text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (ad_account_id, external_id)
);
CREATE INDEX IF NOT EXISTS ad_campaigns_account_idx
  ON public.ad_campaigns (ad_account_id);
CREATE INDEX IF NOT EXISTS ad_campaigns_project_idx
  ON public.ad_campaigns (project_id);

CREATE TABLE IF NOT EXISTS public.ad_campaign_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  date date NOT NULL,
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id, date)
);
CREATE INDEX IF NOT EXISTS ad_campaign_metrics_campaign_date_idx
  ON public.ad_campaign_metrics (campaign_id, date DESC);
CREATE INDEX IF NOT EXISTS ad_campaign_metrics_date_idx
  ON public.ad_campaign_metrics (date DESC);

CREATE TABLE IF NOT EXISTS public.ad_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  date date NOT NULL,
  action_type text NOT NULL,
  count numeric NOT NULL DEFAULT 0,
  value numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id, date, action_type)
);
CREATE INDEX IF NOT EXISTS ad_conversions_campaign_date_idx
  ON public.ad_conversions (campaign_id, date DESC);
CREATE INDEX IF NOT EXISTS ad_conversions_action_type_idx
  ON public.ad_conversions (action_type);

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_campaigns admin" ON public.ad_campaigns;
CREATE POLICY "ad_campaigns admin" ON public.ad_campaigns
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ad_campaign_metrics admin" ON public.ad_campaign_metrics;
CREATE POLICY "ad_campaign_metrics admin" ON public.ad_campaign_metrics
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ad_conversions admin" ON public.ad_conversions;
CREATE POLICY "ad_conversions admin" ON public.ad_conversions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
