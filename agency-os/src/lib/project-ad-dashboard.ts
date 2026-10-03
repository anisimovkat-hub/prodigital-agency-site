import type { TimeseriesPoint } from "@/lib/ad-analytics";

export type AdMetricDay = {
  campaign_id: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
};

export type AdConversionDay = {
  campaign_id: string;
  date: string;
  action_type: string;
  count: number;
};

export type AdDashboardTotals = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number | null;
  cpa: number | null;
};

export function summarizeAdDashboard(
  metrics: AdMetricDay[],
  conversions: AdConversionDay[],
  campaignIds: ReadonlySet<string>,
  goal: string | null,
  oneCurrency: boolean,
): AdDashboardTotals {
  const selectedMetrics = metrics.filter((row) => campaignIds.has(row.campaign_id));
  const spend = selectedMetrics.reduce((total, row) => total + Number(row.spend), 0);
  const count = goal
    ? conversions.filter((row) => campaignIds.has(row.campaign_id) && row.action_type === goal)
      .reduce((total, row) => total + Number(row.count), 0)
    : null;
  return {
    spend,
    impressions: selectedMetrics.reduce((total, row) => total + Number(row.impressions), 0),
    clicks: selectedMetrics.reduce((total, row) => total + Number(row.clicks), 0),
    conversions: count,
    cpa: count && oneCurrency ? spend / count : null,
  };
}

/** A zero baseline is not a comparable percentage. */
export function percentChange(current: number | null, previous: number | null): number | null {
  return current === null || previous === null || previous <= 0
    ? null
    : (current - previous) / previous;
}

export function dailyAdDashboardPoints(
  metrics: AdMetricDay[],
  conversions: AdConversionDay[],
  campaignIds: ReadonlySet<string>,
  goal: string | null,
): TimeseriesPoint[] {
  const days = new Map<string, TimeseriesPoint>();
  const ensure = (date: string) => {
    const existing = days.get(date);
    if (existing) return existing;
    const point: TimeseriesPoint = { bucket: date, spend: 0, impressions: 0, clicks: 0, conversions: 0, conv_value: 0 };
    days.set(date, point);
    return point;
  };
  for (const row of metrics) {
    if (!campaignIds.has(row.campaign_id)) continue;
    const point = ensure(row.date);
    point.spend += Number(row.spend);
    point.impressions += Number(row.impressions);
    point.clicks += Number(row.clicks);
  }
  if (goal) for (const row of conversions) {
    if (!campaignIds.has(row.campaign_id) || row.action_type !== goal) continue;
    ensure(row.date).conversions += Number(row.count);
  }
  return [...days.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}
