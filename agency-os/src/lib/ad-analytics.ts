// Агрегация рекламных данных на уровне кампаний и работа с целями (action_type).
// Meta отдаёт десятки типов действий на одну кампанию: часть — настоящие цели
// (лид, сообщение, покупка), часть — вовлечение (клики, просмотры видео, реакции).
// В БД мы храним ВСЕ, а UI решает, что показывать как цель.

export type CampaignMetricRow = {
  campaign_id: string;
  spend: number;
  impressions: number;
  clicks: number;
};

export type ConversionRow = {
  campaign_id: string;
  action_type: string;
  count: number;
  value: number;
};

export type GoalTotal = {
  actionType: string;
  count: number;
  value: number;
};

export type CampaignSummary = {
  campaignId: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  goals: GoalTotal[];
  otherActions: GoalTotal[];
  primaryGoal: GoalTotal | null;
  cpa: number | null;
};

// Цели по приоритету «главной» для кампании. Агрегирующие типы (lead, purchase)
// стоят выше своих пиксельных вариантов, иначе конверсии считались бы дважды.
export const GOAL_ACTION_TYPES: readonly string[] = [
  "lead",
  "onsite_web_lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "leadgen.other",
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_conversation_replied_7d",
  "onsite_conversion.total_messaging_connection",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
  "complete_registration",
  "omni_complete_registration",
  "offsite_conversion.fb_pixel_complete_registration",
  "submit_application",
  "schedule",
  "subscribe",
  "start_trial",
  "add_to_cart",
  "offsite_conversion.fb_pixel_add_to_cart",
  "initiate_checkout",
  "contact",
  "offsite_conversion.fb_pixel_custom",
];

const GOAL_PRIORITY = new Map(
  GOAL_ACTION_TYPES.map((type, index) => [type, index]),
);

export const ACTION_TYPE_LABEL: Record<string, string> = {
  lead: "Лиды",
  onsite_web_lead: "Лиды на сайте",
  "onsite_conversion.lead_grouped": "Лиды (форма Meta)",
  "offsite_conversion.fb_pixel_lead": "Лиды (пиксель)",
  leadgen_grouped: "Лиды (лид-форма, группа)",
  "leadgen.other": "Лиды (лид-форма)",
  offsite_lead_add_20_s_calls: "Лиды (звонки 20с)",
  offsite_complete_registration_add_meta_leads: "Регистрации (лиды Meta)",
  offsite_complete_registration_add_20_s_calls: "Регистрации (звонки 20с)",
  "onsite_conversion.messaging_conversation_started_7d": "Начатые переписки",
  "onsite_conversion.messaging_conversation_replied_7d": "Ответы в переписке",
  "onsite_conversion.total_messaging_connection": "Переписки (всего)",
  "onsite_conversion.messaging_first_reply": "Первые ответы в переписке",
  "onsite_conversion.messaging_user_depth_2_message_send":
    "Переписки: 2+ сообщения",
  "onsite_conversion.messaging_user_depth_3_message_send":
    "Переписки: 3+ сообщения",
  "onsite_conversion.messaging_user_depth_5_message_send":
    "Переписки: 5+ сообщений",
  "onsite_conversion.messaging_block": "Блокировки в переписке",
  purchase: "Покупки",
  omni_purchase: "Покупки (все источники)",
  "offsite_conversion.fb_pixel_purchase": "Покупки (пиксель)",
  complete_registration: "Регистрации",
  omni_complete_registration: "Регистрации (все источники)",
  "offsite_conversion.fb_pixel_complete_registration": "Регистрации (пиксель)",
  submit_application: "Заявки",
  schedule: "Записи на встречу",
  subscribe: "Подписки",
  start_trial: "Пробные периоды",
  add_to_cart: "Добавления в корзину",
  "offsite_conversion.fb_pixel_add_to_cart": "Корзина (пиксель)",
  initiate_checkout: "Начатые оформления",
  contact: "Обращения",
  "offsite_conversion.fb_pixel_custom": "Своя конверсия (пиксель)",
  link_click: "Клики по ссылке",
  instagram_profile_visit: "Переходы в профиль Instagram",
  profile_visit: "Переходы в профиль",
  follow: "Подписки",
  landing_page_view: "Просмотры лендинга",
  omni_landing_page_view: "Просмотры лендинга (все)",
  post_engagement: "Вовлечение в публикацию",
  page_engagement: "Вовлечение страницы",
  post_interaction_gross: "Взаимодействия с публикацией",
  post_interaction_net: "Взаимодействия (чистые)",
  post_reaction: "Реакции",
  comment: "Комментарии",
  post: "Репосты",
  video_view: "Просмотры видео",
  "video_view.15s": "Просмотры видео 15с",
  photo_view: "Просмотры фото",
  like: "Подписки на страницу",
  "onsite_conversion.post_save": "Сохранения",
  "onsite_conversion.post_net_save": "Сохранения (чистые)",
  "onsite_conversion.post_net_like": "Лайки публикации (чистые)",
  "onsite_conversion.post_net_comment": "Комментарии (чистые)",
  "onsite_conversion.post_unlike": "Снятые лайки",
  "onsite_conversion.post_unsave": "Снятые сохранения",
};

// customNames: conversion_id → имя из справочника ad_custom_conversions.
// Кастомные конверсии приходят как offsite_conversion.custom.<id>; если имя
// известно — показываем его, иначе оставляем id.
export function actionTypeLabel(
  actionType: string,
  customNames?: Map<string, string> | null,
): string {
  const known = ACTION_TYPE_LABEL[actionType];
  if (known) return known;
  const custom = /^offsite_conversion\.custom\.(.+)$/.exec(actionType);
  if (custom) {
    const name = customNames?.get(custom[1]);
    return name ? name : `Своя конверсия ${custom[1]}`;
  }
  return actionType;
}

export function isGoalAction(actionType: string): boolean {
  return (
    GOAL_PRIORITY.has(actionType) ||
    actionType.startsWith("offsite_conversion.custom.")
  );
}

// «Главная» цель кампании: самая приоритетная из непустых.
export function pickPrimaryGoal(goals: GoalTotal[]): GoalTotal | null {
  let best: GoalTotal | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const goal of goals) {
    if (goal.count <= 0) continue;
    const rank = GOAL_PRIORITY.get(goal.actionType) ?? GOAL_ACTION_TYPES.length;
    if (rank < bestRank || (rank === bestRank && best && goal.count > best.count)) {
      best = goal;
      bestRank = rank;
    }
  }
  return best;
}

// --- Фаза B: гранулярность и временной ряд --------------------------------

export type Granularity = "day" | "week" | "month";

export const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "day", label: "По дням" },
  { value: "week", label: "По неделям" },
  { value: "month", label: "По месяцам" },
];

const GRANULARITY_VALUES = new Set<Granularity>(["day", "week", "month"]);

export function isGranularity(value: string | null | undefined): value is Granularity {
  return !!value && GRANULARITY_VALUES.has(value as Granularity);
}

const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

// Короткая подпись бакета для оси графика. Дата — ISO "YYYY-MM-DD" (начало бакета).
export function formatBucketLabel(bucketISO: string, granularity: Granularity): string {
  const [year, month, day] = bucketISO.split("-");
  if (!year || !month || !day) return bucketISO;
  if (granularity === "month") {
    const index = Number(month) - 1;
    return MONTHS_SHORT[index] ?? month;
  }
  return `${day}.${month}`;
}

export type TimeseriesPoint = {
  bucket: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conv_value: number;
};

export type TimeseriesTotals = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  convValue: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpa: number | null;
};

// Итоги по временному ряду для KPI-плашек. Производные (CTR/CPC/CPM/CPA)
// возвращают null, когда знаменатель нулевой, чтобы UI показал прочерк.
export function sumTimeseries(points: TimeseriesPoint[]): TimeseriesTotals {
  const totals = points.reduce(
    (acc, point) => {
      acc.spend += Number(point.spend ?? 0);
      acc.impressions += Number(point.impressions ?? 0);
      acc.clicks += Number(point.clicks ?? 0);
      acc.conversions += Number(point.conversions ?? 0);
      acc.convValue += Number(point.conv_value ?? 0);
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, convValue: 0 },
  );
  return {
    ...totals,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : null,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : null,
    cpa: totals.conversions > 0 ? totals.spend / totals.conversions : null,
  };
}

// Диапазон последних N дней; today передаётся снаружи, чтобы функция была чистой
// (Date.now() в теле рендера запрещён правилом react-hooks/purity).
export function defaultDateRange(
  today: Date,
  days: number,
): { since: string; until: string } {
  const until = today.toISOString().slice(0, 10);
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - days);
  return { since: from.toISOString().slice(0, 10), until };
}

function addTotal(map: Map<string, GoalTotal>, row: ConversionRow): void {
  const current = map.get(row.action_type) ?? {
    actionType: row.action_type,
    count: 0,
    value: 0,
  };
  current.count += Number(row.count ?? 0);
  current.value += Number(row.value ?? 0);
  map.set(row.action_type, current);
}

function byCountDesc(a: GoalTotal, b: GoalTotal): number {
  return b.count - a.count || a.actionType.localeCompare(b.actionType);
}

// Свод по кампаниям за период: расход/показы/клики + конверсии по каждой цели.
export function summarizeCampaigns(
  metrics: CampaignMetricRow[],
  conversions: ConversionRow[],
): Map<string, CampaignSummary> {
  const totals = new Map<
    string,
    { spend: number; impressions: number; clicks: number }
  >();
  for (const row of metrics) {
    const current = totals.get(row.campaign_id) ?? {
      spend: 0,
      impressions: 0,
      clicks: 0,
    };
    current.spend += Number(row.spend ?? 0);
    current.impressions += Number(row.impressions ?? 0);
    current.clicks += Number(row.clicks ?? 0);
    totals.set(row.campaign_id, current);
  }

  const actions = new Map<string, Map<string, GoalTotal>>();
  for (const row of conversions) {
    const perCampaign = actions.get(row.campaign_id) ?? new Map();
    addTotal(perCampaign, row);
    actions.set(row.campaign_id, perCampaign);
  }

  const out = new Map<string, CampaignSummary>();
  const campaignIds = new Set([...totals.keys(), ...actions.keys()]);
  for (const campaignId of campaignIds) {
    const base = totals.get(campaignId) ?? {
      spend: 0,
      impressions: 0,
      clicks: 0,
    };
    const all = [...(actions.get(campaignId)?.values() ?? [])];
    const goals = all.filter((item) => isGoalAction(item.actionType)).sort(byCountDesc);
    const otherActions = all
      .filter((item) => !isGoalAction(item.actionType))
      .sort(byCountDesc);
    const primaryGoal = pickPrimaryGoal(goals);
    out.set(campaignId, {
      campaignId,
      spend: base.spend,
      impressions: base.impressions,
      clicks: base.clicks,
      ctr: base.impressions > 0 ? base.clicks / base.impressions : null,
      cpc: base.clicks > 0 ? base.spend / base.clicks : null,
      cpm: base.impressions > 0 ? (base.spend / base.impressions) * 1000 : null,
      goals,
      otherActions,
      primaryGoal,
      cpa:
        primaryGoal && primaryGoal.count > 0
          ? base.spend / primaryGoal.count
          : null,
    });
  }
  return out;
}
