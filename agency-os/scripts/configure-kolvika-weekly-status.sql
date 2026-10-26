-- Run after migration 0046. Stages only the owner's Monday 08:00 draft status.
-- Activation requires a current, complete seven-day Agency OS import and a
-- reviewed sample message; this script deliberately sends nothing.
DO $$
DECLARE
  v_project uuid := 'e5a66e71-b972-4fbb-b5f4-68c8614916b6';
  v_account uuid;
  v_owner_chat text;
  v_scenario uuid;
  v_direction uuid;
  v_project_direction uuid;
  v_item record;
BEGIN
  SELECT setting_value INTO STRICT v_owner_chat
  FROM public.telegram_bot_settings WHERE setting_key = 'owner_chat_id';
  IF nullif(v_owner_chat, '') IS NULL THEN
    RAISE EXCEPTION 'Bot owner private chat is not paired';
  END IF;

  SELECT id INTO STRICT v_account FROM public.ad_accounts
  WHERE project_id = v_project AND platform = 'yandex_direct' AND is_active = true;

  -- A prior Sofia scenario must not continue sending this project to staff.
  UPDATE public.telegram_weekly_status_scenarios
  SET is_active = false, updated_at = now()
  WHERE project_id = v_project AND template_key = 'project_weekly_ad_status';

  INSERT INTO public.telegram_weekly_status_scenarios
    (project_id, name, channel, recipient_chat_id, recipient_profile_id,
     display_title, timezone, schedule, template_key, report_url, is_active)
  VALUES
    (v_project, 'Kolvika / owner Monday 08:00', 'yandex_direct', v_owner_chat, NULL,
     'Kolvika', 'Europe/Moscow', '0 5 * * 1', 'project_weekly_ad_status',
     'https://docs.google.com/spreadsheets/d/1cH_JNloiX8XSbOG-K36jg1KkS5L8Tt8LvotuNKhfRjw/edit?gid=1594959824#gid=1594959824', false)
  ON CONFLICT (project_id, name) DO UPDATE SET
    recipient_chat_id = EXCLUDED.recipient_chat_id,
    recipient_profile_id = NULL,
    schedule = EXCLUDED.schedule,
    report_url = EXCLUDED.report_url,
    display_title = EXCLUDED.display_title,
    is_active = false,
    updated_at = now()
  RETURNING id INTO v_scenario;

  FOR v_item IN SELECT * FROM (VALUES
    ('Gems4U', '14496817', '17c1698c-b686-4cd8-94ef-381d18ebfabe'::uuid, 0),
    ('Kolvika Center — инструменты и услуги для ювелиров', '71291494', '3e65cab9-461b-4239-89d7-2428dd39d113'::uuid, 1),
    ('Kolvika Jewelry — AI-лендинги', '112938684', 'ea74d330-a4aa-4411-9f26-61589a71e723'::uuid, 2)
  ) AS entry(name, counter_id, direction_id, sort_order) LOOP
    SELECT id INTO STRICT v_project_direction
    FROM public.project_ad_directions
    WHERE id = v_item.direction_id AND project_id = v_project AND is_active = true
      AND v_item.counter_id = ANY(counter_ids)
      AND cardinality(campaign_ids) > 0;

    IF EXISTS (
      SELECT 1 FROM public.project_ad_directions pd
      CROSS JOIN LATERAL unnest(pd.campaign_ids) AS assigned(campaign_id)
      LEFT JOIN public.ad_campaigns c ON c.id = assigned.campaign_id
      WHERE pd.id = v_project_direction AND (
        c.id IS NULL OR c.ad_account_id IS DISTINCT FROM v_account
        OR (NOT (v_item.counter_id = ANY(c.metrika_counter_ids))
          AND NOT (v_item.counter_id = '71291494' AND cardinality(c.metrika_counter_ids) = 0))
      )
    ) THEN
      RAISE EXCEPTION 'Direction % contains missing, foreign or incorrectly scoped campaigns', v_item.name;
    END IF;

    INSERT INTO public.telegram_weekly_status_directions
      (scenario_id, project_direction_id, name, channel, counter_id,
       ad_account_id, include_counterless_campaigns, sort_order, is_active)
    VALUES
      (v_scenario, v_project_direction, v_item.name, 'yandex_direct', v_item.counter_id,
       v_account, v_item.counter_id = '71291494', v_item.sort_order, true)
    ON CONFLICT (scenario_id, counter_id) DO UPDATE SET
      project_direction_id = EXCLUDED.project_direction_id,
      name = EXCLUDED.name,
      ad_account_id = EXCLUDED.ad_account_id,
      include_counterless_campaigns = EXCLUDED.include_counterless_campaigns,
      sort_order = EXCLUDED.sort_order,
      is_active = true
    RETURNING id INTO v_direction;

    IF v_item.counter_id = '14496817' THEN
      INSERT INTO public.telegram_weekly_status_goals
        (direction_id, goal_id, action_type, business_label, metric_kind, value_label, sort_order)
      VALUES
        (v_direction, '194376727', 'yandex_goal:194376727:LC', 'Корзина', 'cart', 'Стоимость товаров в корзинах', 0),
        (v_direction, '3014496817', 'yandex_goal:3014496817:LC', 'Покупка', 'purchase', 'Выручка по покупкам', 1),
        (v_direction, '347388444', 'yandex_goal:347388444:LC', 'Клик по номеру', 'phone', NULL, 2),
        (v_direction, '157962814', 'yandex_goal:157962814:LC', 'Мессенджеры', 'messenger', NULL, 3)
      ON CONFLICT (direction_id, goal_id) DO UPDATE SET
        action_type = EXCLUDED.action_type, business_label = EXCLUDED.business_label,
        metric_kind = EXCLUDED.metric_kind, value_label = EXCLUDED.value_label,
        sort_order = EXCLUDED.sort_order, is_active = true;
    ELSIF v_item.counter_id = '71291494' THEN
      INSERT INTO public.telegram_weekly_status_goals
        (direction_id, goal_id, action_type, business_label, metric_kind, value_label, sort_order)
      VALUES
        (v_direction, '224072509', 'yandex_goal:224072509:LC', 'Корзина', 'cart', 'Стоимость товаров в корзинах', 0),
        (v_direction, '158184796', 'yandex_goal:158184796:LC', 'Клик по номеру', 'phone', NULL, 2)
      ON CONFLICT (direction_id, goal_id) DO UPDATE SET
        action_type = EXCLUDED.action_type, business_label = EXCLUDED.business_label,
        metric_kind = EXCLUDED.metric_kind, value_label = EXCLUDED.value_label,
        sort_order = EXCLUDED.sort_order, is_active = true;
      -- Purchase and messenger GoalIDs are not verified: never invent them.
    ELSE
      INSERT INTO public.telegram_weekly_status_goals
        (direction_id, goal_id, action_type, business_label, metric_kind,
         include_in_contact_cpa, sort_order)
      VALUES
        (v_direction, '661982976', 'yandex_goal:661982976:LC', 'Отправка формы', 'form', true, 0),
        (v_direction, '661983554', 'yandex_goal:661983554:LC', 'Клик по номеру', 'phone', true, 1),
        (v_direction, '661983342', 'yandex_goal:661983342:LC', 'Мессенджеры', 'messenger', true, 2)
      ON CONFLICT (direction_id, goal_id) DO UPDATE SET
        action_type = EXCLUDED.action_type, business_label = EXCLUDED.business_label,
        metric_kind = EXCLUDED.metric_kind, include_in_contact_cpa = true,
        sort_order = EXCLUDED.sort_order, is_active = true;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.telegram_weekly_status_goals g
    JOIN public.telegram_weekly_status_directions d ON d.id = g.direction_id
    WHERE d.scenario_id = v_scenario AND d.is_active AND g.is_active
      AND NOT EXISTS (
        SELECT 1 FROM public.ad_accounts a
        CROSS JOIN LATERAL jsonb_array_elements(a.yandex_goals::jsonb) catalog(goal)
        WHERE a.id = d.ad_account_id AND catalog.goal->>'id' = g.goal_id
          AND catalog.goal->>'counterId' = d.counter_id
      )
  ) THEN
    RAISE EXCEPTION 'Status goal is not verified for its direction counter';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.telegram_weekly_status_directions d
    JOIN public.project_ad_directions pd ON pd.id = d.project_direction_id
    CROSS JOIN LATERAL unnest(pd.campaign_ids) assigned(campaign_id)
    WHERE d.scenario_id = v_scenario AND d.is_active
    GROUP BY assigned.campaign_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'One campaign is assigned to multiple status directions';
  END IF;
END $$;
