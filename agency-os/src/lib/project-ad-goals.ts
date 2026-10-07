import { candidateGoals, extraGoalAction, goalActions, goalLabel, resolveCampaignGoal, type CampaignGoal, type GoalKey } from "@/lib/ad-goals";
import { yandexGoalKey, yandexGoalAction, type YandexGoal } from "@/lib/yandex-goals";
import type { AdConversionDay, AdMetricDay } from "@/lib/project-ad-dashboard";
import type { TimeseriesPoint } from "@/lib/ad-analytics";

export type GoalCampaign = { id: string; platform: string; objective: string | null; optimization_goal: string | null };
export type GoalSetting = { goal_key: string; label: string | null; hidden: boolean; extra: boolean; is_primary?: boolean };
export type ScopedYandexGoal = YandexGoal & { campaignIds: string[] };

/** The goal each campaign works for, from its platform settings and the actions it actually reports. */
export function attributeCampaignGoals(campaigns: GoalCampaign[], conversions: AdConversionDay[]): Map<string, CampaignGoal> {
  const counts = new Map<string, Map<string, number>>();
  for (const row of conversions) {
    const campaignCounts = counts.get(row.campaign_id) ?? new Map<string, number>();
    campaignCounts.set(row.action_type, (campaignCounts.get(row.action_type) ?? 0) + Number(row.count));
    counts.set(row.campaign_id, campaignCounts);
  }
  return new Map(campaigns.map((campaign) => [campaign.id, resolveCampaignGoal(
    candidateGoals(campaign.platform, campaign.objective, campaign.optimization_goal),
    counts.get(campaign.id) ?? new Map(),
  )]));
}

export type GoalTotals = { results: number; spend: number; cpa: number | null; complete?: boolean };
export type GoalCard = {
  key: GoalKey;
  label: string;
  extra: boolean;
  campaignIds: Set<string>;
  current: GoalTotals;
  previous: GoalTotals;
};

function totals(metrics: AdMetricDay[], conversions: AdConversionDay[], campaignActions: Map<string, string>, spendCampaigns: Set<string> | null): GoalTotals {
  const results = conversions.reduce((sum, row) => sum + (campaignActions.get(row.campaign_id) === row.action_type ? Number(row.count) : 0), 0);
  const spend = spendCampaigns ? metrics.reduce((sum, row) => sum + (spendCampaigns.has(row.campaign_id) ? Number(row.spend) : 0), 0) : 0;
  return { results, spend, cpa: spendCampaigns && results > 0 ? spend / results : null };
}

/** A missing/null goal column is not an honest zero. Only imported goal-day rows prove coverage. */
function yandexTotals(metrics: AdMetricDay[], conversions: AdConversionDay[], ids: Set<string>, action: string): GoalTotals {
  const rows = conversions.filter((row) => ids.has(row.campaign_id) && row.action_type === action);
  const measuredDays = new Set(rows.filter((row) => row.is_measured !== false).map((row) => `${row.campaign_id}:${row.date}`));
  const metricRows = metrics.filter((row) => ids.has(row.campaign_id));
  const complete = rows.length > 0 && rows.every((row) => row.is_measured !== false) && metricRows.every((row) => measuredDays.has(`${row.campaign_id}:${row.date}`));
  const result = totals(metrics, rows, new Map([...ids].map((id) => [id, action])), ids);
  return { ...result, complete, cpa: complete ? result.cpa : null };
}

/**
 * One card per goal. A main goal counts only its own campaigns and their spend; an extra goal
 * (e.g. cart for a sales project) counts that action across all selected campaigns and has no
 * cost, because no campaign spends money on it alone.
 */
export function buildGoalCards({ selected, goals, settings, metrics, conversions, previousMetrics, previousConversions, customNames, includeInactive = false, yandexGoals = [] }: {
  selected: Set<string>;
  goals: Map<string, CampaignGoal>;
  settings: GoalSetting[];
  metrics: AdMetricDay[];
  conversions: AdConversionDay[];
  previousMetrics: AdMetricDay[];
  previousConversions: AdConversionDay[];
  customNames?: Map<string, string>;
  includeInactive?: boolean;
  yandexGoals?: ScopedYandexGoal[];
}): GoalCard[] {
  const setting = new Map(settings.map((item) => [item.goal_key, item]));
  const byGoal = new Map<GoalKey, Map<string, string>>();
  for (const id of selected) {
    const goal = goals.get(id);
    if (!goal || goal.key.startsWith('yandex:')) continue;
    const actions = byGoal.get(goal.key) ?? new Map<string, string>();
    actions.set(id, goal.action);
    byGoal.set(goal.key, actions);
  }
  const cards: GoalCard[] = [...byGoal].filter(([key]) => !setting.get(key)?.hidden).map(([key, actions]) => {
    const ids = new Set(actions.keys());
    return {
      key, label: setting.get(key)?.label || goalLabel(key, customNames), extra: false, campaignIds: ids,
      current: totals(metrics, conversions, actions, ids),
      previous: totals(previousMetrics, previousConversions, actions, ids),
    };
  })
    // A goal whose campaigns neither spent nor converted in the period is noise, not a zero result.
    .filter((card) => includeInactive || card.current.spend > 0 || card.current.results > 0)
    .sort((a, b) => b.current.spend - a.current.spend);

  for (const goal of yandexGoals) {
    const key = yandexGoalKey(goal.id);
    if (setting.get(key)?.hidden) continue;
    const ids = new Set(goal.campaignIds.filter((id) => selected.has(id)));
    if (!ids.size) continue;
    cards.push({ key, label: setting.get(key)?.label || goalLabel(key, customNames), extra: false, campaignIds: ids,
      current: yandexTotals(metrics, conversions, ids, yandexGoalAction(goal.id)),
      previous: yandexTotals(previousMetrics, previousConversions, ids, yandexGoalAction(goal.id)),
    });
  }
  const allCounts = new Map<string, number>();
  for (const row of conversions) if (selected.has(row.campaign_id)) allCounts.set(row.action_type, (allCounts.get(row.action_type) ?? 0) + Number(row.count));
  for (const item of settings) {
    const key = item.goal_key as GoalKey;
    if (!item.extra || item.hidden || byGoal.has(key) || key.startsWith('yandex:')) continue;
    const action = extraGoalAction(key, allCounts);
    const actions = new Map([...selected].map((id) => [id, action]));
    cards.push({
      key, label: item.label || goalLabel(key, customNames), extra: true, campaignIds: selected,
      current: totals(metrics, conversions, actions, null),
      previous: totals(previousMetrics, previousConversions, actions, null),
    });
  }
  return cards;
}

/** Daily results and spend of one goal: each campaign contributes its own action only. */
export function goalDailyPoints(metrics: AdMetricDay[], conversions: AdConversionDay[], card: GoalCard, goals: Map<string, CampaignGoal>): TimeseriesPoint[] {
  const days = new Map<string, TimeseriesPoint>();
  const day = (date: string) => days.get(date) ?? days.set(date, { bucket: date, spend: 0, impressions: 0, clicks: 0, conversions: 0, conv_value: 0 }).get(date)!;
  for (const row of metrics) {
    if (!card.campaignIds.has(row.campaign_id)) continue;
    const point = day(row.date);
    if (!card.extra) point.spend += Number(row.spend);
    point.impressions += Number(row.impressions);
    point.clicks += Number(row.clicks);
  }
  const extraAction = card.extra ? extraGoalAction(card.key, new Map(conversions.filter((row) => card.campaignIds.has(row.campaign_id)).map((row) => [row.action_type, Number(row.count)]))) : null;
  for (const row of conversions) {
    if (!card.campaignIds.has(row.campaign_id)) continue;
    const action = card.key.startsWith('yandex:') ? goalActions(card.key)[0] : extraAction ?? goals.get(row.campaign_id)?.action;
    if (row.action_type === action) day(row.date).conversions += Number(row.count);
  }
  return [...days.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}
