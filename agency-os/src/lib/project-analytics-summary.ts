import { actionTypeLabel, isGoalAction, type ConversionRow } from "@/lib/ad-analytics";
import { describeAdDataFreshness } from "@/lib/ad-data-freshness";

type ProjectRow = { id: string; name: string; brand_color?: string | null; started_at?: string | null };
type CampaignRow = { id: string; project_id: string | null; ad_account_id: string };
type AccountRow = { id: string; currency: string | null; project_id?: string | null };
type MetricRow = { campaign_id: string; spend: number; impressions: number; clicks: number };
type DatedConversionRow = ConversionRow & { date: string };

export type ProjectAnalyticsSummary = {
  projectId: string;
  projectName: string;
  brandColor: string | null;
  startedAt: string | null;
  hasData: boolean;
  hasConnectedAccount: boolean;
  freshnessWarning: string | null;
  currency: string | null;
  hasMixedCurrencies: boolean;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  goalLabel: string | null;
  costPerGoal: number | null;
  costPerLead: number | null;
  costPerGoalDeltaPercent: number | null;
  costPerLeadDeltaPercent: number | null;
  spendDeltaPercent: number | null;
  hasMultipleGoalTypes: boolean;
};

type CalculatedMetrics = Omit<ProjectAnalyticsSummary,
  "projectId" | "projectName" | "brandColor" | "startedAt" | "hasConnectedAccount" | "freshnessWarning" |
  "costPerGoalDeltaPercent" | "costPerLeadDeltaPercent" | "spendDeltaPercent"
> & { goalActionType: string | null };

const GOAL_PRIORITY = new Map([
  "lead", "onsite_web_lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "leadgen.other",
  "onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.messaging_conversation_replied_7d",
  "onsite_conversion.total_messaging_connection", "purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase",
  "complete_registration", "omni_complete_registration", "offsite_conversion.fb_pixel_complete_registration",
  "submit_application", "schedule", "subscribe", "start_trial", "add_to_cart", "offsite_conversion.fb_pixel_add_to_cart",
  "initiate_checkout", "contact", "offsite_conversion.fb_pixel_custom",
].map((value, index) => [value, index]));

function primaryConversions(rows: DatedConversionRow[]): DatedConversionRow[] {
  const selected = new Map<string, DatedConversionRow>();
  for (const row of rows) {
    if (Number(row.count) <= 0 || !isGoalAction(row.action_type)) continue;
    const key = `${row.campaign_id}:${row.date}`;
    const current = selected.get(key);
    const rank = GOAL_PRIORITY.get(row.action_type) ?? GOAL_PRIORITY.size;
    const currentRank = current ? GOAL_PRIORITY.get(current.action_type) ?? GOAL_PRIORITY.size : Number.POSITIVE_INFINITY;
    if (!current || rank < currentRank || (rank === currentRank && row.count > current.count)) selected.set(key, row);
  }
  return [...selected.values()];
}

function calculateMetrics({ projectCampaigns, accountCurrency, metrics, conversions }: {
  projectCampaigns: CampaignRow[];
  accountCurrency: Map<string, string | null>;
  metrics: MetricRow[];
  conversions: DatedConversionRow[];
}): CalculatedMetrics {
  const campaignIds = new Set(projectCampaigns.map((campaign) => campaign.id));
  const projectMetrics = metrics.filter((row) => campaignIds.has(row.campaign_id));
  const primaryGoals = primaryConversions(conversions.filter((row) => campaignIds.has(row.campaign_id)));
  const currencies = [...new Set(projectCampaigns.map((campaign) => accountCurrency.get(campaign.ad_account_id)).filter((currency): currency is string => Boolean(currency)))];
  const spend = projectMetrics.reduce((total, row) => total + Number(row.spend ?? 0), 0);
  const impressions = projectMetrics.reduce((total, row) => total + Number(row.impressions ?? 0), 0);
  const clicks = projectMetrics.reduce((total, row) => total + Number(row.clicks ?? 0), 0);
  const goalTypes = new Set(primaryGoals.map((row) => row.action_type));
  const conversionsCount = primaryGoals.reduce((total, row) => total + Number(row.count ?? 0), 0);
  const leadGoals = primaryGoals.filter((row) => row.action_type === "lead" || row.action_type.includes("lead"));
  const leadCampaignIds = new Set(leadGoals.map((row) => row.campaign_id));
  const leadSpend = projectMetrics.filter((row) => leadCampaignIds.has(row.campaign_id)).reduce((total, row) => total + Number(row.spend ?? 0), 0);
  const leadCount = leadGoals.reduce((total, row) => total + Number(row.count ?? 0), 0);
  const goalActionType = goalTypes.size === 1 ? [...goalTypes][0] : null;
  const comparableMoney = currencies.length === 1;

  return {
    hasData: projectMetrics.length > 0 || primaryGoals.length > 0,
    currency: currencies.length === 1 ? currencies[0] : null,
    hasMixedCurrencies: currencies.length > 1,
    spend,
    impressions,
    clicks,
    conversions: conversionsCount,
    goalLabel: goalActionType ? actionTypeLabel(goalActionType) : null,
    goalActionType,
    costPerGoal: comparableMoney && goalActionType && conversionsCount > 0 ? spend / conversionsCount : null,
    costPerLead: comparableMoney && leadCount > 0 ? leadSpend / leadCount : null,
    hasMultipleGoalTypes: goalTypes.size > 1,
  };
}

function percentDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0) return null;
  return (current - previous) / previous * 100;
}

/** Builds non-aggregated cards: costs need one currency and one goal type. */
export function summarizeProjectAnalytics({
  projects, campaigns, accounts, metrics, conversions, previousMetrics = [], previousConversions = [],
  latestMetricDates = [], from, to,
}: {
  projects: ProjectRow[];
  campaigns: CampaignRow[];
  accounts: AccountRow[];
  metrics: MetricRow[];
  conversions: DatedConversionRow[];
  previousMetrics?: MetricRow[];
  previousConversions?: DatedConversionRow[];
  latestMetricDates?: { campaign_id: string; date: string }[];
  from: string;
  to: string;
}): ProjectAnalyticsSummary[] {
  const accountCurrency = new Map(accounts.map((account) => [account.id, account.currency]));

  return projects.map((project) => {
    const projectCampaigns = campaigns.filter((campaign) => campaign.project_id === project.id);
    const campaignIds = new Set(projectCampaigns.map((campaign) => campaign.id));
    const current = calculateMetrics({ projectCampaigns, accountCurrency, metrics, conversions });
    const previous = calculateMetrics({ projectCampaigns, accountCurrency, metrics: previousMetrics, conversions: previousConversions });
    const latestDate = latestMetricDates.filter((row) => campaignIds.has(row.campaign_id)).reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null);
    const hasConnectedAccount = accounts.some((account) => account.project_id === project.id);
    const comparableGoal = current.goalActionType !== null && current.goalActionType === previous.goalActionType;

    return {
      projectId: project.id,
      projectName: project.name,
      brandColor: project.brand_color ?? null,
      startedAt: project.started_at ?? null,
      hasData: current.hasData,
      hasConnectedAccount,
      freshnessWarning: hasConnectedAccount ? describeAdDataFreshness({ latestDate, from, to }) : null,
      currency: current.currency,
      hasMixedCurrencies: current.hasMixedCurrencies,
      spend: current.spend,
      impressions: current.impressions,
      clicks: current.clicks,
      conversions: current.conversions,
      goalLabel: current.goalLabel,
      costPerGoal: current.costPerGoal,
      costPerLead: current.costPerLead,
      costPerGoalDeltaPercent: comparableGoal ? percentDelta(current.costPerGoal, previous.costPerGoal) : null,
      costPerLeadDeltaPercent: percentDelta(current.costPerLead, previous.costPerLead),
      spendDeltaPercent: current.currency && current.currency === previous.currency ? percentDelta(current.spend, previous.spend) : null,
      hasMultipleGoalTypes: current.hasMultipleGoalTypes,
    };
  });
}
