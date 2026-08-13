-- Honest plan/fact for projects with several workstreams or ad-account currencies.

CREATE OR REPLACE FUNCTION public.validate_media_plan_metric_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id uuid;
  v_currency text;
  v_workstream text;
  v_campaign_project_id uuid;
  v_campaign_currency text;
BEGIN
  SELECT plan.project_id, plan.currency, plan.workstream
    INTO v_project_id, v_currency, v_workstream
  FROM public.media_plans plan
  WHERE plan.id = NEW.media_plan_id;

  IF v_workstream IS NOT NULL AND NEW.campaign_id IS NULL THEN
    RAISE EXCEPTION 'Workstream media plan metrics must be linked to a campaign';
  END IF;

  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(campaign.project_id, account.project_id), account.currency
    INTO v_campaign_project_id, v_campaign_currency
  FROM public.ad_campaigns campaign
  JOIN public.ad_accounts account ON account.id = campaign.ad_account_id
  WHERE campaign.id = NEW.campaign_id;

  IF v_campaign_project_id IS DISTINCT FROM v_project_id THEN
    RAISE EXCEPTION 'Campaign does not belong to the media plan project';
  END IF;
  IF v_campaign_currency IS DISTINCT FROM v_currency THEN
    RAISE EXCEPTION 'Campaign currency does not match the media plan currency';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.client_report_plan_fact(
  p_token uuid,
  p_since date,
  p_until date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH report AS (
    SELECT r.project_id
    FROM public.client_reports r
    WHERE r.public_token = p_token AND r.is_active AND r.show_ads
    LIMIT 1
  ),
  selected_plans AS (
    SELECT DISTINCT ON (plan.currency, coalesce(plan.workstream, '')) plan.*
    FROM public.media_plans plan
    JOIN report r ON r.project_id = plan.project_id
    WHERE plan.status = 'approved'
      AND plan.period_start <= p_until
      AND plan.period_end >= p_since
    ORDER BY plan.currency, coalesce(plan.workstream, ''),
      CASE WHEN plan.period_start = p_since AND plan.period_end = p_until THEN 0 ELSE 1 END,
      plan.updated_at DESC
  ),
  rows AS (
    SELECT
      metric.media_plan_id,
      metric.id,
      metric.metric_key,
      metric.label,
      metric.target_value,
      metric.unit,
      metric.conversion_action_type,
      metric.campaign_id,
      metric.sort_order,
      CASE metric.metric_key
        WHEN 'spend' THEN (
          SELECT coalesce(sum(value.spend), 0)::numeric
          FROM public.ad_campaign_metrics value
          JOIN public.ad_campaigns campaign ON campaign.id = value.campaign_id
          JOIN public.ad_accounts account ON account.id = campaign.ad_account_id
          WHERE coalesce(campaign.project_id, account.project_id) = plan.project_id
            AND account.currency = plan.currency
            AND value.date BETWEEN plan.period_start AND plan.period_end
            AND (metric.campaign_id IS NULL OR campaign.id = metric.campaign_id)
        )
        WHEN 'impressions' THEN (
          SELECT coalesce(sum(value.impressions), 0)::numeric
          FROM public.ad_campaign_metrics value
          JOIN public.ad_campaigns campaign ON campaign.id = value.campaign_id
          JOIN public.ad_accounts account ON account.id = campaign.ad_account_id
          WHERE coalesce(campaign.project_id, account.project_id) = plan.project_id
            AND account.currency = plan.currency
            AND value.date BETWEEN plan.period_start AND plan.period_end
            AND (metric.campaign_id IS NULL OR campaign.id = metric.campaign_id)
        )
        WHEN 'clicks' THEN (
          SELECT coalesce(sum(value.clicks), 0)::numeric
          FROM public.ad_campaign_metrics value
          JOIN public.ad_campaigns campaign ON campaign.id = value.campaign_id
          JOIN public.ad_accounts account ON account.id = campaign.ad_account_id
          WHERE coalesce(campaign.project_id, account.project_id) = plan.project_id
            AND account.currency = plan.currency
            AND value.date BETWEEN plan.period_start AND plan.period_end
            AND (metric.campaign_id IS NULL OR campaign.id = metric.campaign_id)
        )
        WHEN 'reach' THEN (
          SELECT coalesce(sum(value.reach), 0)::numeric
          FROM public.ad_campaign_metrics value
          JOIN public.ad_campaigns campaign ON campaign.id = value.campaign_id
          JOIN public.ad_accounts account ON account.id = campaign.ad_account_id
          WHERE coalesce(campaign.project_id, account.project_id) = plan.project_id
            AND account.currency = plan.currency
            AND value.date BETWEEN plan.period_start AND plan.period_end
            AND (metric.campaign_id IS NULL OR campaign.id = metric.campaign_id)
        )
        WHEN 'revenue' THEN (
          SELECT coalesce(sum(selected.value), 0)::numeric
          FROM (
            SELECT DISTINCT ON (value.campaign_id, value.date) value.value
            FROM public.ad_conversions value
            JOIN public.ad_campaigns campaign ON campaign.id = value.campaign_id
            JOIN public.ad_accounts account ON account.id = campaign.ad_account_id
            WHERE coalesce(campaign.project_id, account.project_id) = plan.project_id
              AND account.currency = plan.currency
              AND value.date BETWEEN plan.period_start AND plan.period_end
              AND (metric.campaign_id IS NULL OR campaign.id = metric.campaign_id)
              AND value.action_type IN (
                'purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'
              )
            ORDER BY value.campaign_id, value.date,
              CASE value.action_type
                WHEN 'purchase' THEN 0
                WHEN 'offsite_conversion.fb_pixel_purchase' THEN 1
                ELSE 2
              END
          ) selected
        )
        ELSE (
          SELECT coalesce(sum(value.count), 0)::numeric
          FROM public.ad_conversions value
          JOIN public.ad_campaigns campaign ON campaign.id = value.campaign_id
          JOIN public.ad_accounts account ON account.id = campaign.ad_account_id
          WHERE coalesce(campaign.project_id, account.project_id) = plan.project_id
            AND account.currency = plan.currency
            AND value.date BETWEEN plan.period_start AND plan.period_end
            AND (metric.campaign_id IS NULL OR campaign.id = metric.campaign_id)
            AND value.action_type = metric.conversion_action_type
        )
      END AS fact_value
    FROM public.media_plan_metrics metric
    JOIN selected_plans plan ON plan.id = metric.media_plan_id
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM selected_plans) THEN NULL ELSE
    jsonb_build_object(
      'plans', (
        SELECT coalesce(jsonb_agg(
          jsonb_build_object(
            'plan', to_jsonb(plan) - 'source_url' - 'source_spreadsheet_id' - 'created_by',
            'metrics', coalesce((
              SELECT jsonb_agg(to_jsonb(row_data) - 'media_plan_id' ORDER BY row_data.sort_order, row_data.label)
              FROM rows row_data
              WHERE row_data.media_plan_id = plan.id
            ), '[]'::jsonb)
          ) ORDER BY plan.currency, plan.workstream NULLS FIRST, plan.updated_at DESC
        ), '[]'::jsonb)
        FROM selected_plans plan
      )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.client_report_plan_fact(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_report_plan_fact(uuid, date, date) TO anon, authenticated;
