-- Run after migrations 0045-0047. Stage two owner-only weekly statuses
-- for the shared Agency OS project. This script never sends a message and
-- deliberately leaves both scenarios inactive until live totals are checked.
DO $$
DECLARE
  v_project uuid := '9cda71ea-2511-4981-ad98-59deb1067435';
  v_owner_chat text;
  v_vk_account uuid;
  v_tg_account uuid;
  v_scenario uuid;
  v_direction uuid;
  v_account uuid;
  v_campaign_count integer;
  v_item record;
BEGIN
  PERFORM 1 FROM public.projects WHERE id = v_project AND name = 'Манифест / Прин';
  IF NOT FOUND THEN RAISE EXCEPTION 'Shared Prin/Soda project must be verified first'; END IF;

  SELECT setting_value INTO STRICT v_owner_chat FROM public.telegram_bot_settings
  WHERE setting_key = 'owner_chat_id';
  IF nullif(v_owner_chat, '') IS NULL THEN RAISE EXCEPTION 'Owner private bot chat is not paired'; END IF;

  SELECT a.id INTO STRICT v_vk_account
  FROM public.ad_accounts a JOIN public.ad_account_credentials c ON c.ad_account_id = a.id
  WHERE a.project_id = v_project AND a.platform = 'vk' AND a.is_active;
  SELECT a.id INTO STRICT v_tg_account
  FROM public.ad_accounts a JOIN public.ad_account_credentials c ON c.ad_account_id = a.id
  WHERE a.project_id = v_project AND a.platform = 'telegram_ads' AND a.is_active;

  FOR v_item IN SELECT * FROM (VALUES
    ('ПРИН', 'VK — просмотры карточки', 'vk', 'Прин_каталог товаров', 'Просмотры карточки товара', 'card_view', 'vk:Цели VK Рекламы', 0),
    ('ПРИН', 'VK — подписки', 'vk', 'Прин_набор подписчиков', 'Подписки', 'subscription', 'vk:Цели VK Рекламы', 1),
    ('ПРИН', 'VK — охват постов', 'vk', 'Прин_охват постов', NULL, NULL, NULL, 2),
    ('ПРИН', 'Telegram Ads', 'telegram_ads', 'ПРИН —', 'Вступления', 'join', 'telegram:joins', 3),
    ('СОДА', 'VK — подписки', 'vk', 'Сода//набор подписчиков', 'Подписки', 'subscription', 'vk:Цели VK Рекламы', 0),
    ('СОДА', 'VK — охват постов', 'vk', 'Сода_охват постов', NULL, NULL, NULL, 1),
    ('СОДА', 'Telegram Ads', 'telegram_ads', 'СОДА —', 'Вступления', 'join', 'telegram:joins', 2)
  ) AS x(project_name, direction_name, platform, campaign_prefix, goal_label, goal_kind, action_type, sort_order)
  LOOP
    v_account := CASE WHEN v_item.platform = 'vk' THEN v_vk_account ELSE v_tg_account END;
    SELECT count(*) INTO v_campaign_count FROM public.ad_campaigns c
    WHERE c.project_id = v_project AND c.ad_account_id = v_account
      AND starts_with(lower(c.name), lower(v_item.campaign_prefix));
    IF v_campaign_count = 0 THEN
      RAISE EXCEPTION 'No verified Agency OS campaigns for % / %', v_item.project_name, v_item.direction_name;
    END IF;

    INSERT INTO public.telegram_weekly_status_scenarios
      (project_id, name, channel, recipient_chat_id, recipient_profile_id,
       display_title, timezone, schedule, template_key, report_url, delivery_mode,
       coverage_rules, is_active)
    VALUES
      (v_project, v_item.project_name || ' / owner Monday 08:00', 'mixed', v_owner_chat, NULL,
       v_item.project_name, 'Europe/Moscow', '0 5 * * 1', 'project_weekly_ad_status',
       'https://docs.google.com/spreadsheets/d/1ACaiwXItdSdSQLimgQvaE59Ivac9Bz10G-ceKN2XrVs/edit',
       'owner_review', jsonb_build_array(
         jsonb_build_object('ad_account_id', v_vk_account,
           'prefix', CASE WHEN v_item.project_name = 'ПРИН' THEN 'Прин' ELSE 'Сода' END),
         jsonb_build_object('ad_account_id', v_tg_account,
           'prefix', v_item.project_name)
       ), false)
    ON CONFLICT (project_id, name) DO UPDATE SET
      recipient_chat_id = EXCLUDED.recipient_chat_id,
      recipient_profile_id = NULL,
      report_url = EXCLUDED.report_url,
      delivery_mode = 'owner_review',
      coverage_rules = EXCLUDED.coverage_rules,
      is_active = false,
      updated_at = now()
    RETURNING id INTO v_scenario;

    INSERT INTO public.telegram_weekly_status_directions
      (scenario_id, name, channel, counter_id, ad_account_id,
       campaign_name_prefix, require_vat, allow_no_goals, spend_label,
       sort_order, is_active)
    VALUES
      (v_scenario, v_item.direction_name, v_item.platform, NULL, v_account,
       v_item.campaign_prefix, false, v_item.action_type IS NULL,
       CASE WHEN v_item.platform = 'vk' THEN 'Расход без НДС'
            ELSE 'Расход в ₽ (пересчёт TON)' END,
       v_item.sort_order, true)
    ON CONFLICT (scenario_id, name) DO UPDATE SET
      channel = EXCLUDED.channel,
      counter_id = NULL,
      ad_account_id = EXCLUDED.ad_account_id,
      campaign_ids = '{}',
      campaign_name_prefix = EXCLUDED.campaign_name_prefix,
      require_vat = false,
      allow_no_goals = EXCLUDED.allow_no_goals,
      spend_label = EXCLUDED.spend_label,
      sort_order = EXCLUDED.sort_order,
      is_active = true
    RETURNING id INTO v_direction;

    IF v_item.action_type IS NOT NULL THEN
      INSERT INTO public.telegram_weekly_status_goals
        (direction_id, goal_id, action_type, business_label, metric_kind, sort_order, is_active)
      VALUES (v_direction, 'primary', v_item.action_type, v_item.goal_label,
        v_item.goal_kind, 0, true)
      ON CONFLICT (direction_id, goal_id) DO UPDATE SET
        action_type = EXCLUDED.action_type,
        business_label = EXCLUDED.business_label,
        metric_kind = EXCLUDED.metric_kind,
        is_active = true;
    END IF;
  END LOOP;
END $$;
