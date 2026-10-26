/** Goal IDs are never inferred from conversion counts or campaign names. */
export type YandexGoal = { id: string; name: string; domain: string; counterId: string | null };
export type AdDirection = {
  id: string; project_id: string; name: string; counter_ids: string[]; websites: string[];
  campaign_ids: string[]; primary_goal: string | null; is_active: boolean;
};
export const yandexGoalKey = (id: string) => `yandex:${id}` as const;
export const yandexGoalAction = (id: string) => `yandex_goal:${id}:LC`;

/** A stable, independently bookmarkable report; account data stays stored once. */
export function directionReportHref(direction: Pick<AdDirection, "id" | "project_id">): string {
  return `/analytics?${new URLSearchParams({ project: direction.project_id, direction: direction.id, section: "ads" })}`;
}

/** A verified counter wins over a hostname shared by several products. */
export function directionHasGoal(direction: AdDirection, goal: YandexGoal): boolean {
  if (goal.counterId) return direction.counter_ids.includes(goal.counterId);
  const hostname = (value: string) => {
    try { return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase(); }
    catch { return null; }
  };
  const domain = hostname(goal.domain);
  return Boolean(domain && direction.websites.some((url) => hostname(url) === domain)) || direction.primary_goal === yandexGoalKey(goal.id);
}

export function parseYandexGoals(value: unknown): YandexGoal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || !/^\d+$/.test(row.id) || typeof row.name !== 'string') return [];
    return [{ id: row.id, name: row.name, domain: typeof row.domain === 'string' ? row.domain : '',
      counterId: typeof row.counterId === 'string' && /^\d+$/.test(row.counterId) ? row.counterId : null }];
  });
}

/** Only explicit campaign assignments: a counter alone may be shared by several products. */
export function directionCampaigns(direction: AdDirection, campaigns: { id: string; project_id: string | null }[]): Set<string> {
  return new Set(campaigns.filter((row) => row.project_id === direction.project_id && direction.campaign_ids.includes(row.id)).map((row) => row.id));
}

export function yandexGoalLabel(goal: YandexGoal): string {
  return `${goal.name} · ${goal.counterId ? `№ ${goal.counterId}` : `${goal.domain ? `${goal.domain} · ` : ''}цель ${goal.id}`}`;
}

/** At most this many goals per daily import: 10 goals per report, ~6 reports per account. */
export const YANDEX_SYNC_GOAL_LIMIT = 60;

/**
 * Goals a routine import requests. Owner-visible, default and direction goals always load;
 * explicitly hidden goals never do. Other catalog goals load while the catalog is small;
 * a large catalog (hundreds of Metrika goals) is limited to goals that recently had results,
 * otherwise one account issues dozens of sequential reports and the whole import times out.
 */
export function chooseYandexSyncGoals({ catalog, settings, requiredKeys = [], recentGoalIds, limit = YANDEX_SYNC_GOAL_LIMIT }: {
  catalog: YandexGoal[];
  settings: { goal_key: string; hidden: boolean; is_primary?: boolean | null }[];
  requiredKeys?: (string | null)[];
  recentGoalIds: Set<string>;
  limit?: number;
}): YandexGoal[] {
  const byKey = new Map(settings.map((row) => [row.goal_key, row]));
  const required = new Set(requiredKeys.filter(Boolean) as string[]);
  for (const row of settings) if (!row.hidden || row.is_primary) required.add(row.goal_key);
  const explicit = catalog.filter((goal) => required.has(yandexGoalKey(goal.id)));
  const rest = catalog.filter((goal) => !required.has(yandexGoalKey(goal.id)) && !byKey.get(yandexGoalKey(goal.id))?.hidden);
  if (explicit.length + rest.length <= limit) return [...explicit, ...rest];
  return [...explicit, ...rest.filter((goal) => recentGoalIds.has(goal.id)).slice(0, Math.max(0, limit - explicit.length))];
}
