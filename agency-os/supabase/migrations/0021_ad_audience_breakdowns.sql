-- Срезы аудитории Meta Ads по дням: возраст, пол, страна, регион и площадка.
-- Храним на уровне кампании, чтобы фильтры проекта и периода работали без
-- повторных запросов к Meta Graph API. Доступ — только owner/admin.

CREATE TABLE IF NOT EXISTS public.ad_audience_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  date date NOT NULL,
  breakdown text NOT NULL CHECK (
    breakdown IN ('age', 'gender', 'country', 'region', 'publisher_platform')
  ),
  value text NOT NULL,
  impressions bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id, date, breakdown, value)
);

CREATE INDEX IF NOT EXISTS ad_audience_metrics_campaign_date_idx
  ON public.ad_audience_metrics (campaign_id, date DESC);
CREATE INDEX IF NOT EXISTS ad_audience_metrics_breakdown_date_idx
  ON public.ad_audience_metrics (breakdown, date DESC);

ALTER TABLE public.ad_audience_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_audience_metrics admin" ON public.ad_audience_metrics;
CREATE POLICY "ad_audience_metrics admin" ON public.ad_audience_metrics
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
