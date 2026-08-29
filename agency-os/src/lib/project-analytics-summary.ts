import { actionTypeLabel, isGoalAction, type ConversionRow } from "@/lib/ad-analytics";

type ProjectRow = {
  id: string;
  name: string;
};

type CampaignRow = {
  id: string;
  project_id: string | null;
  ad_account_id: string;
};

type AccountRow = {
  id: string;
  currency: string | null;
};

type MetricRow = {
  campaign_id: string;
  spend: number;
  impressions: number;
  clicks: number;
};

export type ProjectAnalyticsSummary = {
  projectId: string;
  projectName: string;
  hasData: boolean;
  currency: string | null;
  hasMixedCurrencies: boolean;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  goalLabel: string | null;
  costPerGoal: number | null;
  costPerLead: number | null;
  hasMultipleGoalTypes: boolean;
};

type DatedConversionRow = ConversionRow & { date: string };

const GOAL_PRIORITY = new Map([
  "lead", "onsite_web_lead", "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead", "leadgen.other",
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_conversation_replied_7d",
  "onsite_conversion.total_messaging_connection", "purchase",
  "offsite_conversion.fb_pixel_purchase", "omni_purchase", "complete_registration",
  "omni_complete_registration", "offsite_conversion.fb_pixel_complete_registration",
  "submit_application", "schedule", "subscribe", "start_trial", "add_to_cart",
  "offsite_conversion.fb_pixel_add_to_cart", "initiate_checkout", "contact",
  "offsite_conversion.fb_pixel_custom",
].map((value, index) => [value, index]));

function primaryConversions(rows: DatedConversionRow[]): DatedConversionRow[] {
  const selected = new Map<string, DatedConversionRow>();
  for (const row of rows) {
    if (Number(row.count) <= 0 || !isGoalAction(row.action_type)) continue;
    const key = `${row.campaign_id}:${row.date}`;
    const current = selected.get(key);
    const rank = GOAL_PRIORITY.get(row.action_type) ?? GOAL_PRIORITY.size;
    const currentRank = current
      ? GOAL_PRIORITY.get(current.action_type) ?? GOAL_PRIORITY.size
      : Number.POSITIVE_INFINITY;
    if (!current || rank < currentRank || (rank === currentRank && row.count > current.count)) {
      selected.set(key, row);
    }
  }
  return [...selected.values()];
}

function isLead(actionType: string): boolean {
  return actionType === "lead" || actionType.includes("lead");
}

/** Builds non-aggregated cards: costs need one currency and one goal type. */
export function summarizeProjectAnalytics({
  projects,
  campaigns,
  accounts,
  metrics,
  conversions,
}: {
  projects: ProjectRow[];
  campaigns: CampaignRow[];
  accounts: AccountRow[];
  metrics: MetricRow[];
  conversions: DatedConversionRow[];
}): ProjectAnalyticsSummary[] {
  const accountCurrency = new Map(accounts.map((account) => [account.id, account.currency]));

  return projects.map((project) => {
    const projectCampaigns = campaigns.filter((campaign) => campaign.project_id === project.id);
    const campaignIds = new Set(projectCampaigns.map((campaign) => campaign.id));
    const projectMetrics = metrics.filter((row) => campaignIds.has(row.campaign_id));
    const primaryGoals = primaryConversions(conversions.filter((row) => campaignIds.has(row.campaign_id)));
    const currencies = [...new Set(projectCampaigns
      .map((campaign) => accountCurrency.get(campaign.ad_account_id))
      .filter((currency): currency is string => Boolean(currency)))];
    const spend = projectMetrics.reduce((total, row) => total + Number(row.spend ?? 0), 0);
    const impressions = projectMetrics.reduce((total, row) => total + Number(row.impressions ?? 0), 0);
    const clicks = projectMetrics.reduce((total, row) => total + Number(row.clicks ?? 0), 0);
    const goalTypes = new Set(primaryGoals.map((row) => row.action_type));
    const conversionsCount = primaryGoals.reduce((total, row) => total + Number(row.count ?? 0), 0);
    const leadGoals = primaryGoals.filter((row) => isLead(row.action_type));
    const leadCampaignIds = new Set(leadGoals.map((row) => row.campaign_id));
    const leadSpend = projectMetrics.filter((row) => leadCampaignIds.has(row.campaign_id))
      .reduce((total, row) => total + Number(row.spend ?? 0), 0);
    const leadCount = leadGoals.reduce((total, row) => total + Number(row.count ?? 0), 0);
    const oneGoalType = goalTypes.size === 1 ? [...goalTypes][0] : null;
    const comparableMoney = currencies.length === 1;

    return {
      projectId: project.id,
      projectName: project.name,
      hasData: projectMetrics.length > 0 || primaryGoals.length > 0,
      currency: currencies.length === 1 ? currencies[0] : null,
      hasMixedCurrencies: currencies.length > 1,
      spend,
      impressions,
      clicks,
      conversions: conversionsCount,
      goalLabel: oneGoalType ? actionTypeLabel(oneGoalType) : null,
      costPerGoal: comparableMoney && oneGoalType && conversionsCount > 0 ? spend / conversionsCount : null,
      costPerLead: comparableMoney && leadCount > 0 ? leadSpend / leadCount : null,
      hasMultipleGoalTypes: goalTypes.size > 1,
    };
  });
}
