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
  goals: GoalTotal[];
  otherActions: GoalTotal[];
  primaryGoal: GoalTotal | null;
  cpa: number | null;
};

// Цели по приоритету «главной» для кампании. Агрегирующие типы (lead, purchase)
// стоят выше своих пиксельных вариантов, иначе конверсии считались бы дважды.
export const GOAL_ACTION_TYPES: readonly string[] = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "leadgen.other",
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
  "complete_registration",
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
  "onsite_conversion.lead_grouped": "Лиды (форма Meta)",
  "offsite_conversion.fb_pixel_lead": "Лиды (пиксель)",
  "leadgen.other": "Лиды (лид-форма)",
  "onsite_conversion.messaging_conversation_started_7d": "Начатые переписки",
  "onsite_conversion.total_messaging_connection": "Переписки (всего)",
  "onsite_conversion.messaging_first_reply": "Первые ответы в переписке",
  purchase: "Покупки",
  omni_purchase: "Покупки (все источники)",
  "offsite_conversion.fb_pixel_purchase": "Покупки (пиксель)",
  complete_registration: "Регистрации",
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
  landing_page_view: "Просмотры лендинга",
  post_engagement: "Вовлечение в публикацию",
  page_engagement: "Вовлечение страницы",
  post_reaction: "Реакции",
  comment: "Комментарии",
  post: "Репосты",
  video_view: "Просмотры видео",
  "video_view.15s": "Просмотры видео 15с",
  photo_view: "Просмотры фото",
  like: "Подписки на страницу",
  "onsite_conversion.post_save": "Сохранения",
  "onsite_conversion.messaging_block": "Блокировки в переписке",
};

export function actionTypeLabel(actionType: string): string {
  const known = ACTION_TYPE_LABEL[actionType];
  if (known) return known;
  // Кастомные конверсии приходят как offsite_conversion.custom.<id> — показываем id.
  const custom = /^offsite_conversion\.custom\.(\d+)$/.exec(actionType);
  if (custom) return `Своя конверсия ${custom[1]}`;
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
