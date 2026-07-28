-- Реклама: иерархия групп объявлений (ad set) и объявлений (ad) для
-- разворачиваемого отчёта кампания → группа → объявление (как в Ads Manager).
-- Симметрично кампаниям: сущности + суточные метрики + конверсии по всем целям.
-- Детальная загрузка (level=adset/ad) тяжёлая, поэтому идёт отдельной кнопкой,
-- но хранится суточно, чтобы таблица считалась за любой выбранный период.
-- Доступ: только владелец (is_admin).

CREATE TABLE IF NOT EXISTS public.ad_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text,
  status text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id, external_id)
);
CREATE INDEX IF NOT EXISTS ad_sets_campaign_idx ON public.ad_sets (campaign_id);

CREATE TABLE IF NOT EXISTS public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adset_id uuid NOT NULL REFERENCES public.ad_sets(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text,
  status text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (adset_id, external_id)
);
CREATE INDEX IF NOT EXISTS ads_adset_idx ON public.ads (adset_id);

CREATE TABLE IF NOT EXISTS public.ad_set_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adset_id uuid NOT NULL REFERENCES public.ad_sets(id) ON DELETE CASCADE,
  date date NOT NULL,
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (adset_id, date)
);
CREATE INDEX IF NOT EXISTS ad_set_metrics_adset_date_idx
  ON public.ad_set_metrics (adset_id, date DESC);

CREATE TABLE IF NOT EXISTS public.ad_ad_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  date date NOT NULL,
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (ad_id, date)
);
CREATE INDEX IF NOT EXISTS ad_ad_metrics_ad_date_idx
  ON public.ad_ad_metrics (ad_id, date DESC);

CREATE TABLE IF NOT EXISTS public.ad_set_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adset_id uuid NOT NULL REFERENCES public.ad_sets(id) ON DELETE CASCADE,
  date date NOT NULL,
  action_type text NOT NULL,
  count numeric NOT NULL DEFAULT 0,
  value numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (adset_id, date, action_type)
);
CREATE INDEX IF NOT EXISTS ad_set_conversions_adset_date_idx
  ON public.ad_set_conversions (adset_id, date DESC);

CREATE TABLE IF NOT EXISTS public.ad_ad_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  date date NOT NULL,
  action_type text NOT NULL,
  count numeric NOT NULL DEFAULT 0,
  value numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (ad_id, date, action_type)
);
CREATE INDEX IF NOT EXISTS ad_ad_conversions_ad_date_idx
  ON public.ad_ad_conversions (ad_id, date DESC);

ALTER TABLE public.ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_set_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_ad_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_set_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_ad_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_sets admin" ON public.ad_sets;
CREATE POLICY "ad_sets admin" ON public.ad_sets
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "ads admin" ON public.ads;
CREATE POLICY "ads admin" ON public.ads
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "ad_set_metrics admin" ON public.ad_set_metrics;
CREATE POLICY "ad_set_metrics admin" ON public.ad_set_metrics
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "ad_ad_metrics admin" ON public.ad_ad_metrics;
CREATE POLICY "ad_ad_metrics admin" ON public.ad_ad_metrics
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "ad_set_conversions admin" ON public.ad_set_conversions;
CREATE POLICY "ad_set_conversions admin" ON public.ad_set_conversions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "ad_ad_conversions admin" ON public.ad_ad_conversions;
CREATE POLICY "ad_ad_conversions admin" ON public.ad_ad_conversions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
