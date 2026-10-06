import { makeConverter, type FxRate } from "@/lib/fx-rates";
import type { AdMetricDay } from "@/lib/project-ad-dashboard";

export type ReportCurrency = "native" | "USD" | "RUB";

/** USD remains the default; an explicit original-currency choice travels with report filters. */
export function reportCurrency(value: string | undefined): ReportCurrency {
  return value === "native" || value === "RUB" ? value : "USD";
}

export function reportCurrencyHref(path: string, query: string, currency: ReportCurrency): string {
  const params = new URLSearchParams(query);
  params.set("cur", currency);
  return `${path}?${params}`;
}

/** Native mode never combines different money units, including across comparison periods. */
export function prepareReportCurrency({ mode, rates, metrics, previousMetrics, campaignCurrencies, fallbackCurrencies }: {
  mode: ReportCurrency;
  rates: FxRate[];
  metrics: AdMetricDay[];
  previousMetrics: AdMetricDay[];
  campaignCurrencies: Map<string, string | null>;
  fallbackCurrencies: (string | null)[];
}) {
  const activity = [...metrics, ...previousMetrics];
  const nativeCurrencies = [...new Set(activity.length
    ? activity.map((row) => campaignCurrencies.get(row.campaign_id) ?? null)
    : fallbackCurrencies)];
  const nativeCurrency = nativeCurrencies.length === 1 ? nativeCurrencies[0] : null;
  const target = mode === "native" ? nativeCurrency : mode;
  const convert = target ? makeConverter(rates, target) : null;
  const period = (rows: AdMetricDay[]) => {
    let complete = !!target;
    const converted = rows.map((row) => {
      const original = campaignCurrencies.get(row.campaign_id) ?? null;
      const spend = mode === "native"
        ? target && original === target ? Number(row.spend) : null
        : convert?.(Number(row.spend), original, row.date) ?? null;
      if (spend === null) complete = false;
      // Never expose a partial converted total as a complete summary.
      return { ...row, spend: spend ?? 0 };
    });
    return { metrics: complete ? converted : rows, currency: complete ? target : null };
  };
  const nativeSpend = new Map<string | null, number>();
  for (const row of metrics) {
    const currency = campaignCurrencies.get(row.campaign_id) ?? null;
    nativeSpend.set(currency, (nativeSpend.get(currency) ?? 0) + Number(row.spend));
  }
  return {
    current: period(metrics), previous: period(previousMetrics), nativeCurrency,
    mixedNative: mode === "native" && nativeCurrencies.length > 1,
    nativeSpend: [...nativeSpend].map(([currency, spend]) => ({ currency, spend })),
  };
}
