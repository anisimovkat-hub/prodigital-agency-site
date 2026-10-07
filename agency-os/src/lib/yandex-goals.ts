/** Goal IDs are never inferred from conversion counts or campaign names. */
export type YandexGoal = { id: string; name: string; domain: string; counterId: string | null };
export type AdDirection = {
  id: string; project_id: string; name: string; counter_ids: string[]; websites: string[];
  campaign_ids: string[]; primary_goal: string | null; is_active: boolean;
};
export const yandexGoalKey = (id: string) => `yandex:${id}` as const;
export const yandexGoalAction = (id: string) => `yandex_goal:${id}:LC`;

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
  return `${goal.name} · ${goal.counterId ? `№ ${goal.counterId}` : goal.domain || `цель ${goal.id}`}`;
}
