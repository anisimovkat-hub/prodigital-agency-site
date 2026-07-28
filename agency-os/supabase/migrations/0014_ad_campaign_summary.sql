-- Реклама, фаза A: свод по кампаниям за период одной строкой на кампанию.
-- Зачем функция, а не выборка из таблиц: конверсий много (кампания × день × action_type),
-- и PostgREST по умолчанию отдаёт максимум 1000 строк — сырые данные молча обрезались бы.
-- Функция SECURITY INVOKER (по умолчанию), поэтому RLS рекламных таблиц работает как есть:
-- владелец видит всё, остальные — пустой результат.

CREATE OR REPLACE FUNCTION public.ad_campaign_period_summary(
  p_since date,
  p_until date
)
RETURNS TABLE (
  campaign_id uuid,
  spend numeric,
  impressions bigint,
  clicks bigint,
  reach bigint,
  conversions jsonb
)
LANGUAGE sql
STABLE
AS $$
  WITH metrics AS (
    SELECT
      cm.campaign_id AS cid,
      sum(cm.spend) AS spend,
      sum(cm.impressions) AS impressions,
      sum(cm.clicks) AS clicks,
      sum(cm.reach) AS reach
    FROM public.ad_campaign_metrics cm
    WHERE cm.date BETWEEN p_since AND p_until
    GROUP BY cm.campaign_id
  ),
  per_action AS (
    SELECT
      conv.campaign_id AS cid,
      conv.action_type AS action_type,
      sum(conv.count) AS total_count,
      sum(conv.value) AS total_value
    FROM public.ad_conversions conv
    WHERE conv.date BETWEEN p_since AND p_until
    GROUP BY conv.campaign_id, conv.action_type
  ),
  actions AS (
    SELECT
      per_action.cid AS cid,
      jsonb_agg(
        jsonb_build_object(
          'action_type', per_action.action_type,
          'count', per_action.total_count,
          'value', per_action.total_value
        )
        ORDER BY per_action.total_count DESC
      ) AS conversions
    FROM per_action
    GROUP BY per_action.cid
  )
  SELECT
    COALESCE(metrics.cid, actions.cid) AS campaign_id,
    COALESCE(metrics.spend, 0) AS spend,
    COALESCE(metrics.impressions, 0) AS impressions,
    COALESCE(metrics.clicks, 0) AS clicks,
    COALESCE(metrics.reach, 0) AS reach,
    COALESCE(actions.conversions, '[]'::jsonb) AS conversions
  FROM metrics
  FULL OUTER JOIN actions ON actions.cid = metrics.cid;
$$;
