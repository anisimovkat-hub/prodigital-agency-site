export type MediaPlanMetricDefinition = {
  id: string;
  metric_key: string;
  label: string;
  target_value: number;
  unit: "money" | "count" | "percent";
  conversion_action_type: string | null;
  campaign_id: string | null;
  sort_order: number;
  notes: string | null;
};

export type MediaPlanCampaign = {
  id: string;
  project_id: string | null;
  ad_account_id: string;
};

export type MediaPlanAccount = {
  id: string;
  project_id: string | null;
  currency: string | null;
};

export type MediaPlanCampaignMetric = {
  campaign_id: string;
  date?: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
};

export type MediaPlanConversion = {
  campaign_id: string;
  date?: string;
  action_type: string;
  count: number;
  value: number;
};

export type MediaPlanFactRow = MediaPlanMetricDefinition & {
  factValue: number;
  completion: number | null;
  variance: number;
  currencyMismatch: boolean;
};

export function calculateMediaPlanFact({
  projectId,
  currency,
  metrics,
  campaigns,
  accounts,
  campaignMetrics,
  conversions,
}: {
  projectId: string;
  currency: string;
  metrics: MediaPlanMetricDefinition[];
  campaigns: MediaPlanCampaign[];
  accounts: MediaPlanAccount[];
  campaignMetrics: MediaPlanCampaignMetric[];
  conversions: MediaPlanConversion[];
}): MediaPlanFactRow[] {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const validCampaignIds = new Set(
    campaigns.flatMap((campaign) => {
      const account = accountsById.get(campaign.ad_account_id);
      const campaignProjectId = campaign.project_id ?? account?.project_id ?? null;
      return campaignProjectId === projectId && account?.currency === currency
        ? [campaign.id]
        : [];
    }),
  );
  const projectCampaignIds = new Set(
    campaigns.flatMap((campaign) => {
      const account = accountsById.get(campaign.ad_account_id);
      return (campaign.project_id ?? account?.project_id ?? null) === projectId
        ? [campaign.id]
        : [];
    }),
  );

  return metrics
    .map((metric) => {
      const scope = metric.campaign_id
        ? new Set(validCampaignIds.has(metric.campaign_id) ? [metric.campaign_id] : [])
        : validCampaignIds;
      const factValue = factForMetric(metric, scope, campaignMetrics, conversions);
      const target = Number(metric.target_value);
      return {
        ...metric,
        target_value: target,
        factValue,
        completion: target > 0 ? factValue / target : null,
        variance: factValue - target,
        currencyMismatch: Boolean(
          metric.campaign_id &&
            projectCampaignIds.has(metric.campaign_id) &&
            !validCampaignIds.has(metric.campaign_id),
        ),
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "ru"));
}

function factForMetric(
  metric: MediaPlanMetricDefinition,
  campaignIds: Set<string>,
  campaignMetrics: MediaPlanCampaignMetric[],
  conversions: MediaPlanConversion[],
): number {
  if (metric.metric_key === "spend") {
    return sumCampaignMetric(campaignMetrics, campaignIds, "spend");
  }
  if (metric.metric_key === "impressions") {
    return sumCampaignMetric(campaignMetrics, campaignIds, "impressions");
  }
  if (metric.metric_key === "clicks") {
    return sumCampaignMetric(campaignMetrics, campaignIds, "clicks");
  }
  if (metric.metric_key === "reach") {
    return sumCampaignMetric(campaignMetrics, campaignIds, "reach");
  }
  if (metric.metric_key === "revenue") {
    return primaryPurchaseValues(conversions, campaignIds).reduce(
      (sum, row) =>
        sum + Number(row.value),
      0,
    );
  }
  if (metric.metric_key.startsWith("conversion:") && metric.conversion_action_type) {
    return conversions.reduce(
      (sum, row) =>
        campaignIds.has(row.campaign_id) &&
        row.action_type === metric.conversion_action_type
          ? sum + Number(row.count)
          : sum,
      0,
    );
  }
  return 0;
}

const PURCHASE_ACTIONS = [
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
  "omni_purchase",
] as const;

/** Meta часто возвращает один purchase сразу под несколькими action_type. */
function primaryPurchaseValues(
  rows: MediaPlanConversion[],
  campaignIds: Set<string>,
): MediaPlanConversion[] {
  const priority = new Map(PURCHASE_ACTIONS.map((value, index) => [value, index]));
  const selected = new Map<string, MediaPlanConversion>();
  for (const row of rows) {
    if (!campaignIds.has(row.campaign_id) || !isPurchaseAction(row.action_type)) continue;
    const key = `${row.campaign_id}:${row.date ?? "period"}`;
    const current = selected.get(key);
    const rank = priority.get(row.action_type as (typeof PURCHASE_ACTIONS)[number]) ?? PURCHASE_ACTIONS.length;
    const currentRank = current
      ? priority.get(current.action_type as (typeof PURCHASE_ACTIONS)[number]) ?? PURCHASE_ACTIONS.length
      : Number.POSITIVE_INFINITY;
    if (!current || rank < currentRank) selected.set(key, row);
  }
  return [...selected.values()];
}

function sumCampaignMetric(
  rows: MediaPlanCampaignMetric[],
  campaignIds: Set<string>,
  key: "spend" | "impressions" | "clicks" | "reach",
): number {
  return rows.reduce(
    (sum, row) => campaignIds.has(row.campaign_id) ? sum + Number(row[key]) : sum,
    0,
  );
}

function isPurchaseAction(value: string): boolean {
  return PURCHASE_ACTIONS.includes(value as (typeof PURCHASE_ACTIONS)[number]);
}
