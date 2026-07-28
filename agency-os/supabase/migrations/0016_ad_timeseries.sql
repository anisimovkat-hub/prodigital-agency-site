-- Реклама, фаза B: временной ряд для графиков с фильтрами и гранулярностью.
-- Один вызов отдаёт расход/показы/клики + конверсии по ОДНОЙ выбранной цели
-- (p_action_type) по бакетам day/week/month. Фильтры project/account/campaign —
-- необязательные (NULL = не фильтровать). date_trunc(text, date) безопасен от
-- инъекций (это функция, а не динамический SQL), но гранулярность всё равно
-- валидируется на стороне приложения белым списком.
-- search_path пустой сразу (линтер function_search_path_mutable), все объекты
-- указаны со схемой public. Функция SECURITY INVOKER — RLS решает доступ.

CREATE OR REPLACE FUNCTION public.ad_timeseries(
  p_since date,
  p_until date,
  p_granularity text,
  p_project_id uuid DEFAULT NULL,
  p_account_id uuid DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL,
  p_action_type text DEFAULT NULL
)
RETURNS TABLE (
  bucket date,
  spend numeric,
  impressions bigint,
  clicks bigint,
  conversions numeric,
  conv_value numeric
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH metrics AS (
    SELECT
      date_trunc(p_granularity, cm.date)::date AS bucket,
      sum(cm.spend) AS spend,
      sum(cm.impressions) AS impressions,
      sum(cm.clicks) AS clicks
    FROM public.ad_campaign_metrics cm
    JOIN public.ad_campaigns c ON c.id = cm.campaign_id
    WHERE cm.date BETWEEN p_since AND p_until
      AND (p_project_id IS NULL OR c.project_id = p_project_id)
      AND (p_account_id IS NULL OR c.ad_account_id = p_account_id)
      AND (p_campaign_id IS NULL OR c.id = p_campaign_id)
    GROUP BY 1
  ),
  conv AS (
    SELECT
      date_trunc(p_granularity, ac.date)::date AS bucket,
      sum(ac.count) AS conversions,
      sum(ac.value) AS conv_value
    FROM public.ad_conversions ac
    JOIN public.ad_campaigns c ON c.id = ac.campaign_id
    WHERE ac.date BETWEEN p_since AND p_until
      AND p_action_type IS NOT NULL
      AND ac.action_type = p_action_type
      AND (p_project_id IS NULL OR c.project_id = p_project_id)
      AND (p_account_id IS NULL OR c.ad_account_id = p_account_id)
      AND (p_campaign_id IS NULL OR c.id = p_campaign_id)
    GROUP BY 1
  )
  SELECT
    COALESCE(metrics.bucket, conv.bucket) AS bucket,
    COALESCE(metrics.spend, 0) AS spend,
    COALESCE(metrics.impressions, 0) AS impressions,
    COALESCE(metrics.clicks, 0) AS clicks,
    COALESCE(conv.conversions, 0) AS conversions,
    COALESCE(conv.conv_value, 0) AS conv_value
  FROM metrics
  FULL OUTER JOIN conv ON conv.bucket = metrics.bucket
  ORDER BY 1;
$$;
