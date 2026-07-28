-- Реклама: своды по группам объявлений и объявлениям за период — по одной строке
-- на сущность с конверсиями массивом jsonb (как ad_campaign_period_summary).
-- Возвращают parent-id (campaign_id / adset_id), чтобы UI строил дерево кампания →
-- группа → объявление без дополнительных запросов. SECURITY INVOKER, search_path=''.

CREATE OR REPLACE FUNCTION public.ad_set_period_summary(
  p_since date,
  p_until date
)
RETURNS TABLE (
  adset_id uuid,
  campaign_id uuid,
  spend numeric,
  impressions bigint,
  clicks bigint,
  reach bigint,
  conversions jsonb
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH metrics AS (
    SELECT
      m.adset_id AS eid,
      sum(m.spend) AS spend,
      sum(m.impressions) AS impressions,
      sum(m.clicks) AS clicks,
      sum(m.reach) AS reach
    FROM public.ad_set_metrics m
    WHERE m.date BETWEEN p_since AND p_until
    GROUP BY m.adset_id
  ),
  per_action AS (
    SELECT
      c.adset_id AS eid,
      c.action_type AS action_type,
      sum(c.count) AS total_count,
      sum(c.value) AS total_value
    FROM public.ad_set_conversions c
    WHERE c.date BETWEEN p_since AND p_until
    GROUP BY c.adset_id, c.action_type
  ),
  actions AS (
    SELECT
      per_action.eid AS eid,
      jsonb_agg(
        jsonb_build_object(
          'action_type', per_action.action_type,
          'count', per_action.total_count,
          'value', per_action.total_value
        )
        ORDER BY per_action.total_count DESC
      ) AS conversions
    FROM per_action
    GROUP BY per_action.eid
  )
  SELECT
    s.id AS adset_id,
    s.campaign_id AS campaign_id,
    COALESCE(metrics.spend, 0) AS spend,
    COALESCE(metrics.impressions, 0) AS impressions,
    COALESCE(metrics.clicks, 0) AS clicks,
    COALESCE(metrics.reach, 0) AS reach,
    COALESCE(actions.conversions, '[]'::jsonb) AS conversions
  FROM public.ad_sets s
  JOIN metrics ON metrics.eid = s.id
  LEFT JOIN actions ON actions.eid = s.id;
$$;

CREATE OR REPLACE FUNCTION public.ad_ad_period_summary(
  p_since date,
  p_until date
)
RETURNS TABLE (
  ad_id uuid,
  adset_id uuid,
  spend numeric,
  impressions bigint,
  clicks bigint,
  reach bigint,
  conversions jsonb
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH metrics AS (
    SELECT
      m.ad_id AS eid,
      sum(m.spend) AS spend,
      sum(m.impressions) AS impressions,
      sum(m.clicks) AS clicks,
      sum(m.reach) AS reach
    FROM public.ad_ad_metrics m
    WHERE m.date BETWEEN p_since AND p_until
    GROUP BY m.ad_id
  ),
  per_action AS (
    SELECT
      c.ad_id AS eid,
      c.action_type AS action_type,
      sum(c.count) AS total_count,
      sum(c.value) AS total_value
    FROM public.ad_ad_conversions c
    WHERE c.date BETWEEN p_since AND p_until
    GROUP BY c.ad_id, c.action_type
  ),
  actions AS (
    SELECT
      per_action.eid AS eid,
      jsonb_agg(
        jsonb_build_object(
          'action_type', per_action.action_type,
          'count', per_action.total_count,
          'value', per_action.total_value
        )
        ORDER BY per_action.total_count DESC
      ) AS conversions
    FROM per_action
    GROUP BY per_action.eid
  )
  SELECT
    a.id AS ad_id,
    a.adset_id AS adset_id,
    COALESCE(metrics.spend, 0) AS spend,
    COALESCE(metrics.impressions, 0) AS impressions,
    COALESCE(metrics.clicks, 0) AS clicks,
    COALESCE(metrics.reach, 0) AS reach,
    COALESCE(actions.conversions, '[]'::jsonb) AS conversions
  FROM public.ads a
  JOIN metrics ON metrics.eid = a.id
  LEFT JOIN actions ON actions.eid = a.id;
$$;
