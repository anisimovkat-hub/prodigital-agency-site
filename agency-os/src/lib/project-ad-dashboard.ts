import type { Granularity, TimeseriesPoint } from "@/lib/ad-analytics";

export type AdMetricDay = {
  campaign_id: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
};

export type AdConversionDay = {
  is_measured?: boolean;
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
  const goalRows = conversions.filter((row) => campaignIds.has(row.campaign_id) && row.action_type === goal);
  const measuredDays = new Set(goalRows.filter((row) => row.is_measured !== false).map((row) => `${row.campaign_id}:${row.date}`));
  const measured = !goal?.startsWith('yandex_goal:') || (goalRows.length > 0 && goalRows.every((row) => row.is_measured !== false) && selectedMetrics.every((row) => measuredDays.has(`${row.campaign_id}:${row.date}`)));
  const count = goal && measured
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

export function aggregateAdDashboardPoints(points: TimeseriesPoint[], granularity: Granularity): TimeseriesPoint[] {
  if (granularity === "day") return points;
  const buckets = new Map<string, TimeseriesPoint>();
  for (const point of points) {
    const date = new Date(`${point.bucket}T00:00:00Z`);
    if (granularity === "week") date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    else date.setUTCDate(1);
    const key = date.toISOString().slice(0, 10);
    const bucket = buckets.get(key) ?? { bucket: key, spend: 0, impressions: 0, clicks: 0, conversions: 0, conv_value: 0 };
    for (const field of ["spend", "impressions", "clicks", "conversions", "conv_value"] as const) bucket[field] += point[field];
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

/** Every day of the period gets a bucket, so charts keep a true time axis. */
export function fillAdDashboardDays(points: TimeseriesPoint[], from: string, to: string): TimeseriesPoint[] {
  const byDay = new Map(points.map((point) => [point.bucket, point]));
  const days: TimeseriesPoint[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= end && days.length < 1100; time += 86_400_000) {
    const bucket = new Date(time).toISOString().slice(0, 10);
    days.push(byDay.get(bucket) ?? { bucket, spend: 0, impressions: 0, clicks: 0, conversions: 0, conv_value: 0 });
  }
  return days;
}

const CURRENCY_SIGN: Record<string, string> = { RUB: "₽", USD: "$", EUR: "€", GBP: "£" };

/** Locale-independent formatting: identical on the server and in the browser. */
export function formatAdNumber(value: number, fractionDigits = 0): string {
  const sign = value < 0 ? "-" : "";
  const [whole, fraction] = Math.abs(value).toFixed(fractionDigits).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const trimmed = fraction?.replace(/0+$/, "");
  return `${sign}${grouped}${trimmed ? `,${trimmed}` : ""}`;
}

export function formatAdMoney(value: number, currency: string | null): string {
  const digits = Math.abs(value) < 100 && value !== 0 ? 2 : 0;
  const amount = formatAdNumber(value, digits);
  if (!currency) return amount;
  const sign = CURRENCY_SIGN[currency];
  if (!sign) return `${amount} ${currency}`;
  return currency === "RUB" ? `${amount} ₽` : `${sign}${amount}`;
}

/** Growth above +200% reads better as a multiple: "×107" instead of "10 600%". */
export function formatAdPercent(value: number): string {
  if (value >= 2) return `×${formatAdNumber(1 + value, 1 + value < 10 ? 1 : 0)}`;
  return `${formatAdNumber(Math.abs(value * 100), Math.abs(value) < 0.1 ? 1 : 0)}%`;
}
