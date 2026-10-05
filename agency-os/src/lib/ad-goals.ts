/**
 * Campaign goals: what each campaign is optimized for, grouped into business goals.
 * Different goals are never added together; each goal's cost uses only the spend of
 * the campaigns that work for it.
 */

export type GoalKey =
  | "leads" | "messages" | "purchases" | "cart" | "checkout" | "registrations" | "applications"
  | "contacts" | "subscriptions" | "landing" | "clicks" | "profile" | "engagement" | "video"
  | "telegram_joins" | "vk_goals" | "yandex_conversions" | `custom:${string}`;

type GoalDefinition = { label: string; actions: string[] };

/** Ordered action variants per goal: the first one with data wins, so variants are never summed. */
export const GOALS: Record<Exclude<GoalKey, `custom:${string}`>, GoalDefinition> = {
  leads: { label: "Лиды", actions: ["lead", "onsite_conversion.lead_grouped", "leadgen.other", "onsite_web_lead", "offsite_conversion.fb_pixel_lead"] },
  messages: { label: "Переписки", actions: ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection", "onsite_conversion.messaging_conversation_replied_7d"] },
  purchases: { label: "Покупки", actions: ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"] },
  cart: { label: "Добавления в корзину", actions: ["add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"] },
  checkout: { label: "Оформления заказа", actions: ["initiate_checkout"] },
  registrations: { label: "Регистрации", actions: ["complete_registration", "omni_complete_registration", "offsite_conversion.fb_pixel_complete_registration"] },
  applications: { label: "Заявки", actions: ["submit_application", "schedule"] },
  contacts: { label: "Обращения", actions: ["contact"] },
  subscriptions: { label: "Подписки", actions: ["subscribe", "follow", "like"] },
  landing: { label: "Просмотры сайта", actions: ["landing_page_view", "omni_landing_page_view"] },
  clicks: { label: "Клики по ссылке", actions: ["link_click"] },
  profile: { label: "Переходы в профиль", actions: ["instagram_profile_visit", "profile_visit"] },
  engagement: { label: "Вовлечение", actions: ["post_engagement", "page_engagement"] },
  video: { label: "Просмотры видео", actions: ["video_view"] },
  telegram_joins: { label: "Вступления в Telegram", actions: ["telegram:joins"] },
  vk_goals: { label: "Цели VK Рекламы", actions: ["vk:Цели VK Рекламы"] },
  yandex_conversions: { label: "Конверсии Яндекса", actions: ["yandex:conversions"] },
};

const PIXEL_EVENTS: Record<string, GoalKey> = {
  PURCHASE: "purchases", ADD_TO_CART: "cart", INITIATED_CHECKOUT: "checkout", LEAD: "leads",
  COMPLETE_REGISTRATION: "registrations", SUBMIT_APPLICATION: "applications", SCHEDULE: "applications",
  CONTACT: "contacts", SUBSCRIBE: "subscriptions", START_TRIAL: "subscriptions",
};

const OPTIMIZATION_GOALS: Record<string, GoalKey[]> = {
  LEAD_GENERATION: ["leads"], QUALITY_LEAD: ["leads"], QUALITY_CALL: ["leads"],
  CONVERSATIONS: ["messages"], REPLIES: ["messages"],
  LINK_CLICKS: ["clicks"], LANDING_PAGE_VIEWS: ["landing", "clicks"],
  PROFILE_VISIT: ["profile"], VISIT_INSTAGRAM_PROFILE: ["profile"], PROFILE_AND_PAGE_ENGAGEMENT: ["profile", "engagement"],
  POST_ENGAGEMENT: ["engagement"], PAGE_LIKES: ["subscriptions"], THRUPLAY: ["video"], TWO_SECOND_CONTINUOUS_VIDEO_VIEWS: ["video"],
};

/** Campaign objective is the fallback when ad set settings are unknown. */
const OBJECTIVES: Record<string, GoalKey[]> = {
  OUTCOME_LEADS: ["leads", "messages", "registrations", "applications"],
  OUTCOME_SALES: ["purchases", "cart", "checkout", "leads", "messages"],
  OUTCOME_TRAFFIC: ["landing", "clicks", "profile"],
  OUTCOME_ENGAGEMENT: ["messages", "engagement", "video", "subscriptions"],
  OUTCOME_APP_PROMOTION: ["registrations"],
};

const PLATFORM_GOALS: Record<string, GoalKey> = { telegram_ads: "telegram_joins", vk: "vk_goals", yandex_direct: "yandex_conversions" };

export function goalLabel(key: GoalKey, customNames?: Map<string, string>): string {
  if (key.startsWith("custom:")) return customNames?.get(key.slice(7)) ?? "Своя конверсия";
  return GOALS[key as keyof typeof GOALS].label;
}

export function goalActions(key: GoalKey): string[] {
  return key.startsWith("custom:") ? [`offsite_conversion.custom.${key.slice(7)}`] : GOALS[key as keyof typeof GOALS].actions;
}

/**
 * Candidate goals from the platform settings, best first.
 * optimizationGoal is stored as "GOAL" or "GOAL:EVENT" or "GOAL:custom:<id>" (Meta ad sets).
 */
export function candidateGoals(platform: string, objective: string | null, optimizationGoal: string | null): GoalKey[] {
  if (PLATFORM_GOALS[platform]) return [PLATFORM_GOALS[platform]];
  const [goal, event, customId] = (optimizationGoal ?? "").split(":");
  if (event === "custom" && customId) return [`custom:${customId}`];
  if (event && PIXEL_EVENTS[event]) return [PIXEL_EVENTS[event]];
  if (goal && OPTIMIZATION_GOALS[goal]) return OPTIMIZATION_GOALS[goal];
  if (goal === "REACH" || goal === "IMPRESSIONS" || goal === "AD_RECALL_LIFT") return [];
  return OBJECTIVES[objective ?? ""] ?? [];
}

export type CampaignGoal = { key: GoalKey; action: string } | null;

/**
 * The goal a campaign works for: the first candidate with results in the period, else the
 * first candidate (honest zero). Reach/awareness campaigns have no target action.
 */
export function resolveCampaignGoal(candidates: GoalKey[], counts: ReadonlyMap<string, number>): CampaignGoal {
  for (const key of candidates) {
    const action = goalActions(key).find((item) => (counts.get(item) ?? 0) > 0);
    if (action) return { key, action };
  }
  return candidates.length ? { key: candidates[0], action: goalActions(candidates[0])[0] } : null;
}

/** For an extra goal counted over all campaigns: the first variant that has data. */
export function extraGoalAction(key: GoalKey, counts: ReadonlyMap<string, number>): string {
  const actions = goalActions(key);
  return actions.find((action) => (counts.get(action) ?? 0) > 0) ?? actions[0];
}

/** Every goal that has data among the given action types (offered as extra goals). */
export function goalsWithData(actionTypes: Iterable<string>): GoalKey[] {
  const present = new Set(actionTypes);
  const keys = (Object.keys(GOALS) as (keyof typeof GOALS)[]).filter((key) => GOALS[key].actions.some((action) => present.has(action)));
  const custom = [...present].filter((action) => action.startsWith("offsite_conversion.custom.")).map((action) => `custom:${action.slice(26)}` as GoalKey);
  return [...keys, ...custom];
}
