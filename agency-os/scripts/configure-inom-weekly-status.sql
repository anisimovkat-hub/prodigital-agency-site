-- Run after migration 0046. This stages INOM safely; it does not send messages.
-- Verify the weekly figures before setting
-- telegram_weekly_status_scenarios.is_active = true.
DO $$
DECLARE
  v_project uuid := 'ffc9e115-8838-420e-966b-f538df18f0af';
  v_account uuid;
  v_owner_chat text;
  v_campaign_ids uuid[];
  v_scenario uuid;
  v_direction uuid;
BEGIN
  SELECT id INTO STRICT v_account
  FROM public.ad_accounts
  WHERE project_id = v_project AND platform = 'yandex_direct' AND external_id = 'fortilda26';

  SELECT setting_value INTO STRICT v_owner_chat FROM public.telegram_bot_settings
  WHERE setting_key = 'owner_chat_id';
  IF nullif(v_owner_chat, '') IS NULL THEN
    RAISE EXCEPTION 'Bot owner private chat is not paired';
  END IF;

  SELECT coalesce(array_agg(id), '{}'::uuid[]) INTO v_campaign_ids
  FROM public.ad_campaigns WHERE ad_account_id = v_account;
  IF cardinality(v_campaign_ids) = 0 THEN
    RAISE EXCEPTION 'No imported INOM campaigns to scope';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ad_campaigns
    WHERE ad_account_id = v_account
      AND cardinality(metrika_counter_ids) > 0
      AND NOT ('109204270' = ANY(metrika_counter_ids))
  ) THEN
    RAISE EXCEPTION 'fortilda26 contains campaigns with another Metrika counter; review direction scope first';
  END IF;

  INSERT INTO public.telegram_weekly_status_scenarios
    (project_id, name, channel, recipient_chat_id, recipient_profile_id,
     display_title, show_direction_heading, spend_label, timezone, schedule,
     template_key, is_active)
  VALUES
    (v_project, 'ИНОМ / fortilda26', 'yandex_direct', v_owner_chat, NULL,
     'Отчёт ИНОМ (запасной аккаунт fortilda26)', false, 'Расход',
     'Europe/Moscow', '0 5 * * 1', 'project_weekly_ad_status', false)
  ON CONFLICT (project_id, name) DO UPDATE SET
    recipient_chat_id = EXCLUDED.recipient_chat_id,
    recipient_profile_id = NULL,
    display_title = EXCLUDED.display_title,
    show_direction_heading = EXCLUDED.show_direction_heading,
    spend_label = EXCLUDED.spend_label,
    schedule = EXCLUDED.schedule,
    is_active = false
  RETURNING id INTO v_scenario;

  INSERT INTO public.telegram_weekly_status_directions
    (scenario_id, name, channel, counter_id, ad_account_id,
     campaign_ids, include_counterless_campaigns, sort_order, is_active)
  VALUES
    (v_scenario, 'ИНОМ', 'yandex_direct', '109204270', v_account,
     v_campaign_ids, true, 0, true)
  ON CONFLICT (scenario_id, counter_id) DO UPDATE SET
    ad_account_id = EXCLUDED.ad_account_id,
    campaign_ids = EXCLUDED.campaign_ids,
    include_counterless_campaigns = EXCLUDED.include_counterless_campaigns,
    name = EXCLUDED.name
  RETURNING id INTO v_direction;

  INSERT INTO public.telegram_weekly_status_goals
    (direction_id, goal_id, action_type, business_label, metric_kind, sort_order, is_active)
  VALUES
    (v_direction, '559741388', 'yandex_goal:559741388:LC', 'Страница «Спасибо»', 'form', 0, true),
    (v_direction, '559241229', 'yandex_goal:559241229:LC', 'CRM: Заказ создан', 'form', 1, true)
  ON CONFLICT (direction_id, goal_id) DO UPDATE SET
    action_type = EXCLUDED.action_type,
    business_label = EXCLUDED.business_label,
    metric_kind = EXCLUDED.metric_kind,
    sort_order = EXCLUDED.sort_order;
END $$;
