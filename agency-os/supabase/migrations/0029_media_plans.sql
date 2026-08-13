-- Плановые KPI: один утверждённый медиаплан на проект/направление/период/валюту.
-- Факт не копируется: он остаётся в ad_* и сопоставляется при чтении.

CREATE TABLE IF NOT EXISTS public.media_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workstream text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'archived')),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'google_sheets')),
  source_spreadsheet_id text,
  source_range text,
  source_url text,
  imported_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_plans_valid_period CHECK (period_end >= period_start),
  CONSTRAINT media_plans_google_source CHECK (
    source_type = 'manual'
    OR (source_spreadsheet_id IS NOT NULL AND source_range IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.media_plan_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_plan_id uuid NOT NULL REFERENCES public.media_plans(id) ON DELETE CASCADE,
  metric_key text NOT NULL CHECK (
    metric_key IN ('spend', 'impressions', 'clicks', 'reach', 'revenue')
    OR metric_key ~ '^conversion:[^[:space:]]+$'
  ),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  target_value numeric NOT NULL CHECK (target_value >= 0),
  unit text NOT NULL CHECK (unit IN ('money', 'count', 'percent')),
  conversion_action_type text,
  campaign_id uuid REFERENCES public.ad_campaigns(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_plan_metric_conversion_match CHECK (
    (metric_key LIKE 'conversion:%'
      AND conversion_action_type = substr(metric_key, length('conversion:') + 1))
    OR (metric_key NOT LIKE 'conversion:%' AND conversion_action_type IS NULL)
  ),
  CONSTRAINT media_plan_metric_unit_match CHECK (
    (metric_key IN ('spend', 'revenue') AND unit = 'money')
    OR (metric_key IN ('impressions', 'clicks', 'reach') AND unit = 'count')
    OR (metric_key LIKE 'conversion:%' AND unit = 'count')
  ),
  CONSTRAINT media_plan_metric_percent_reserved CHECK (unit <> 'percent')
);

CREATE INDEX IF NOT EXISTS media_plans_project_period_idx
  ON public.media_plans(project_id, period_start DESC, period_end DESC);
CREATE INDEX IF NOT EXISTS media_plan_metrics_plan_order_idx
  ON public.media_plan_metrics(media_plan_id, sort_order, created_at);

-- NULL-направление приводится к пустой строке, чтобы уникальность работала предсказуемо.
CREATE UNIQUE INDEX IF NOT EXISTS media_plans_one_approved_scope_idx
  ON public.media_plans(
    project_id,
    coalesce(workstream, ''),
    period_start,
    period_end,
    currency
  )
  WHERE status = 'approved';

CREATE UNIQUE INDEX IF NOT EXISTS media_plan_metrics_unique_scope_idx
  ON public.media_plan_metrics(
    media_plan_id,
    metric_key,
    coalesce(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

ALTER TABLE public.media_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_plan_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read media plans" ON public.media_plans;
CREATE POLICY "members read media plans" ON public.media_plans
  FOR SELECT USING (
    public.is_admin() OR public.is_project_member(project_id)
  );

DROP POLICY IF EXISTS "admin creates media plans" ON public.media_plans;
CREATE POLICY "admin creates media plans" ON public.media_plans
  FOR INSERT WITH CHECK (public.is_admin() AND created_by = auth.uid());

DROP POLICY IF EXISTS "admin updates media plans" ON public.media_plans;
CREATE POLICY "admin updates media plans" ON public.media_plans
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin deletes media plans" ON public.media_plans;
CREATE POLICY "admin deletes media plans" ON public.media_plans
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "members read media plan metrics" ON public.media_plan_metrics;
CREATE POLICY "members read media plan metrics" ON public.media_plan_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.media_plans plan
      WHERE plan.id = media_plan_id
        AND (public.is_admin() OR public.is_project_member(plan.project_id))
    )
  );

DROP POLICY IF EXISTS "admin creates media plan metrics" ON public.media_plan_metrics;
CREATE POLICY "admin creates media plan metrics" ON public.media_plan_metrics
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin updates media plan metrics" ON public.media_plan_metrics;
CREATE POLICY "admin updates media plan metrics" ON public.media_plan_metrics
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin deletes media plan metrics" ON public.media_plan_metrics;
CREATE POLICY "admin deletes media plan metrics" ON public.media_plan_metrics
  FOR DELETE USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.touch_media_plan_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_plans_touch_updated_at ON public.media_plans;
CREATE TRIGGER media_plans_touch_updated_at
  BEFORE UPDATE ON public.media_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_media_plan_updated_at();

CREATE OR REPLACE FUNCTION public.validate_media_plan_metric_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id uuid;
  v_currency text;
  v_campaign_project_id uuid;
  v_campaign_currency text;
BEGIN
  IF NEW.campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT plan.project_id, plan.currency
    INTO v_project_id, v_currency
  FROM public.media_plans plan
  WHERE plan.id = NEW.media_plan_id;

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

DROP TRIGGER IF EXISTS media_plan_metrics_validate_scope ON public.media_plan_metrics;
CREATE TRIGGER media_plan_metrics_validate_scope
  BEFORE INSERT OR UPDATE OF media_plan_id, campaign_id
  ON public.media_plan_metrics
  FOR EACH ROW EXECUTE FUNCTION public.validate_media_plan_metric_scope();

-- Публичный клиентский отчёт получает только утверждённый план/факт выбранного проекта.
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
  selected_plan AS (
    SELECT plan.*
    FROM public.media_plans plan
    JOIN report r ON r.project_id = plan.project_id
    WHERE plan.status = 'approved'
      AND plan.period_start <= p_until
      AND plan.period_end >= p_since
    ORDER BY
      CASE WHEN plan.period_start = p_since AND plan.period_end = p_until THEN 0 ELSE 1 END,
      plan.updated_at DESC
    LIMIT 1
  ),
  rows AS (
    SELECT
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
            SELECT DISTINCT ON (value.campaign_id, value.date)
              value.value
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
    JOIN selected_plan plan ON plan.id = metric.media_plan_id
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM selected_plan) THEN NULL ELSE
    jsonb_build_object(
      'plan', (SELECT to_jsonb(plan) - 'source_url' - 'source_spreadsheet_id' - 'created_by' FROM selected_plan plan),
      'metrics', coalesce((SELECT jsonb_agg(to_jsonb(rows) ORDER BY sort_order, label) FROM rows), '[]'::jsonb)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.client_report_plan_fact(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_report_plan_fact(uuid, date, date) TO anon, authenticated;
