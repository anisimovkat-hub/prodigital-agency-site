-- Weekly status reports can use explicitly assigned VK/Telegram campaigns as
-- well as Yandex counter-scoped directions. Existing scenarios become owner
-- previews until the owner explicitly switches their delivery mode.
ALTER TABLE public.telegram_weekly_status_scenarios
  ADD COLUMN delivery_mode text NOT NULL DEFAULT 'owner_review'
    CHECK (delivery_mode IN ('owner_review', 'staff_auto')),
  ADD COLUMN coverage_rules jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(coverage_rules) = 'array');

ALTER TABLE public.telegram_weekly_status_directions
  ALTER COLUMN counter_id DROP NOT NULL,
  ADD COLUMN campaign_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN campaign_name_prefix text,
  ADD COLUMN require_vat boolean NOT NULL DEFAULT true,
  ADD COLUMN allow_no_goals boolean NOT NULL DEFAULT false,
  ADD COLUMN spend_label text;

ALTER TABLE public.telegram_weekly_status_directions
  ADD CONSTRAINT weekly_status_direction_scope CHECK (
    (channel = 'yandex_direct' AND counter_id IS NOT NULL)
    OR (channel <> 'yandex_direct' AND counter_id IS NULL
      AND ad_account_id IS NOT NULL
      AND (cardinality(campaign_ids) > 0 OR length(campaign_name_prefix) >= 4))
  ),
  ADD CONSTRAINT weekly_status_direction_spend_label CHECK (
    require_vat OR nullif(spend_label, '') IS NOT NULL
  );

ALTER TABLE public.telegram_weekly_status_goals
  DROP CONSTRAINT IF EXISTS telegram_weekly_status_goals_goal_id_check,
  DROP CONSTRAINT IF EXISTS telegram_weekly_status_goals_action_type_check,
  DROP CONSTRAINT IF EXISTS telegram_weekly_status_goals_metric_kind_check;

ALTER TABLE public.telegram_weekly_status_goals
  ADD CONSTRAINT weekly_status_goal_id_nonempty CHECK (length(goal_id) BETWEEN 1 AND 100),
  ADD CONSTRAINT weekly_status_action_type_nonempty CHECK (length(action_type) BETWEEN 1 AND 160),
  ADD CONSTRAINT weekly_status_metric_kind_valid CHECK (
    metric_kind IN ('cart', 'purchase', 'phone', 'messenger', 'form',
      'subscription', 'card_view', 'join', 'engagement')
  );

CREATE INDEX weekly_status_direction_campaign_ids_idx
  ON public.telegram_weekly_status_directions USING gin(campaign_ids);

ALTER TABLE public.telegram_weekly_status_directions
  ADD CONSTRAINT weekly_status_direction_name_unique UNIQUE (scenario_id, name);
