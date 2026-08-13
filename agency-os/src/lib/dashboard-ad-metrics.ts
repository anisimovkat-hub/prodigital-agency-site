import { isGoalAction, pickPrimaryGoal } from "@/lib/ad-analytics";

export type DashboardAdAccount = {
  id: string;
  project_id: string | null;
  currency: string | null;
};

export type DashboardAdCampaign = {
  id: string;
  ad_account_id: string;
  project_id: string | null;
};

export type DashboardCampaignPeriodRow = {
  campaign_id: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: {
    action_type: string;
    count: number;
    value: number;
  }[];
};

export type ProjectAdMetrics = {
  currency: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  primaryGoals: { actionType: string; count: number }[];
  costPerResult: number | null;
  hasMixedGoals: boolean;
};

export type ProjectAdDeliveryTotals = {
  impressions: number;
  clicks: number;
  goals: { actionType: string; count: number }[];
};

type MutableProjectAdMetrics = Omit<
  ProjectAdMetrics,
  "primaryGoals" | "costPerResult" | "hasMixedGoals"
> & {
  primaryGoals: Map<string, number>;
};

export function rollingDateRange(until: string, days: number): {
  since: string;
  until: string;
} {
  const safeDays = Math.max(1, Math.floor(days));
  const start = new Date(`${until}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (safeDays - 1));
  return { since: start.toISOString().slice(0, 10), until };
}

export function aggregateProjectAdMetrics(
  accounts: DashboardAdAccount[],
  campaigns: DashboardAdCampaign[],
  rows: DashboardCampaignPeriodRow[],
  visibleProjectIds: Set<string>,
): Map<string, ProjectAdMetrics[]> {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const campaignById = new Map(
    campaigns.map((campaign) => [campaign.id, campaign]),
  );
  const grouped = new Map<string, Map<string, MutableProjectAdMetrics>>();

  for (const row of rows) {
    const campaign = campaignById.get(row.campaign_id);
    if (!campaign) continue;
    const account = accountById.get(campaign.ad_account_id);
    const projectId = campaign.project_id ?? account?.project_id ?? null;
    if (!projectId || !visibleProjectIds.has(projectId)) continue;

    const currency = account?.currency?.trim().toUpperCase() || null;
    const currencyKey = currency ?? "__unknown__";
    const perProject = grouped.get(projectId) ?? new Map();
    const current = perProject.get(currencyKey) ?? {
      currency,
      spend: 0,
      impressions: 0,
      clicks: 0,
      results: 0,
      primaryGoals: new Map<string, number>(),
    };

    current.spend += Number(row.spend ?? 0);
    current.impressions += Number(row.impressions ?? 0);
    current.clicks += Number(row.clicks ?? 0);

    const primaryGoal = pickPrimaryGoal(
      (row.conversions ?? [])
        .filter((conversion) => isGoalAction(conversion.action_type))
        .map((conversion) => ({
          actionType: conversion.action_type,
          count: Number(conversion.count ?? 0),
          value: Number(conversion.value ?? 0),
        })),
    );
    if (primaryGoal) {
      current.results += primaryGoal.count;
      current.primaryGoals.set(
        primaryGoal.actionType,
        (current.primaryGoals.get(primaryGoal.actionType) ?? 0) +
          primaryGoal.count,
      );
    }

    perProject.set(currencyKey, current);
    grouped.set(projectId, perProject);
  }

  const result = new Map<string, ProjectAdMetrics[]>();
  for (const [projectId, perCurrency] of grouped) {
    const metrics = [...perCurrency.values()]
      .map((item): ProjectAdMetrics => {
        const primaryGoals = [...item.primaryGoals.entries()]
          .map(([actionType, count]) => ({ actionType, count }))
          .sort((a, b) => b.count - a.count || a.actionType.localeCompare(b.actionType));
        const hasMixedGoals = primaryGoals.length > 1;
        return {
          currency: item.currency,
          spend: item.spend,
          impressions: item.impressions,
          clicks: item.clicks,
          results: item.results,
          primaryGoals,
          hasMixedGoals,
          costPerResult:
            !hasMixedGoals && item.results > 0
              ? item.spend / item.results
              : null,
        };
      })
      .sort((a, b) => (a.currency ?? "").localeCompare(b.currency ?? ""));
    result.set(projectId, metrics);
  }

  return result;
}

export function summarizeProjectAdDelivery(
  metrics: ProjectAdMetrics[],
): ProjectAdDeliveryTotals {
  const goals = new Map<string, number>();
  let impressions = 0;
  let clicks = 0;
  for (const item of metrics) {
    impressions += item.impressions;
    clicks += item.clicks;
    for (const goal of item.primaryGoals) {
      goals.set(goal.actionType, (goals.get(goal.actionType) ?? 0) + goal.count);
    }
  }
  return {
    impressions,
    clicks,
    goals: [...goals.entries()]
      .map(([actionType, count]) => ({ actionType, count }))
      .sort((a, b) => b.count - a.count || a.actionType.localeCompare(b.actionType)),
  };
}

export function formatAdMoney(
  value: number | null | undefined,
  currency: string | null,
): string {
  if (value === null || value === undefined) return "—";
  if (!currency) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} · валюта не указана`;
  }
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
  }
}
