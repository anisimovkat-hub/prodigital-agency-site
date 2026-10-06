import { describe, expect, it } from "vitest";
import { prepareReportCurrency, reportCurrency, reportCurrencyHref } from "@/lib/ad-report-currency";
import type { AdMetricDay } from "@/lib/project-ad-dashboard";

const rates = [
  { date: "2026-09-01", currency: "USD", rub_per_unit: 80 },
  { date: "2026-09-01", currency: "AED", rub_per_unit: 20 },
  { date: "2026-09-01", currency: "GBP", rub_per_unit: 100 },
  { date: "2026-09-01", currency: "IDR", rub_per_unit: 0.005 },
  { date: "2026-09-02", currency: "USD", rub_per_unit: 100 },
];
const row = (campaign_id: string, spend: number, date = "2026-09-01"): AdMetricDay => ({ campaign_id, spend, date, impressions: 100, clicks: 10 });
const setup = { rates, metrics: [row("c1", 400)], previousMetrics: [], campaignCurrencies: new Map([["c1", "AED"]]), fallbackCurrencies: ["AED"] };

describe("report currency", () => {
  it("defaults to USD and honours explicit original or ruble mode", () => {
    expect(reportCurrency(undefined)).toBe("USD");
    expect(reportCurrency("AED")).toBe("USD");
    expect(reportCurrency("native")).toBe("native");
    expect(reportCurrency("RUB")).toBe("RUB");
  });
  it("preserves the tab, project, dates, account and goal in navigation", () => {
    const url = reportCurrencyHref("/analytics", "section=overview&project=p1&account=a1&goal=leads&from=2026-09-01&to=2026-09-30&cur=RUB", "native");
    expect(url).toBe("/analytics?section=overview&project=p1&account=a1&goal=leads&from=2026-09-01&to=2026-09-30&cur=native");
  });
  it.each([["AED", 400, 100], ["GBP", 80, 100], ["IDR", 1600000, 100]])("converts %s account spend into USD", (currency, spend, expected) => {
    const result = prepareReportCurrency({ ...setup, mode: "USD", metrics: [row("c1", spend)], campaignCurrencies: new Map([["c1", currency]]) });
    expect(result.current.currency).toBe("USD");
    expect(result.current.metrics[0].spend).toBeCloseTo(expected);
  });
  it("converts to RUB and applies each day's own rate", () => {
    expect(prepareReportCurrency({ ...setup, mode: "RUB" }).current.metrics[0].spend).toBe(8000);
    const result = prepareReportCurrency({ ...setup, mode: "USD", metrics: [row("c1", 400, "2026-09-02")], previousMetrics: [row("c1", 400)] });
    expect(result.current.metrics[0].spend).toBe(80);
    expect(result.previous.metrics[0].spend).toBe(100);
  });
  it("preserves original amounts without needing any FX rates", () => {
    const result = prepareReportCurrency({ ...setup, rates: [], mode: "native" });
    expect(result.current.currency).toBe("AED");
    expect(result.current.metrics[0].spend).toBe(400);
  });
  it("keeps mixed native money separate, but permits a complete USD summary", () => {
    const mixed = { ...setup, metrics: [row("c1", 400), row("c2", 80)], campaignCurrencies: new Map([["c1", "AED"], ["c2", "GBP"]]) };
    const native = prepareReportCurrency({ ...mixed, mode: "native" });
    expect(native.current.currency).toBeNull();
    expect(native.mixedNative).toBe(true);
    expect(native.nativeSpend).toEqual([{ currency: "AED", spend: 400 }, { currency: "GBP", spend: 80 }]);
    expect(prepareReportCurrency({ ...mixed, mode: "USD" }).current.metrics.reduce((sum, item) => sum + item.spend, 0)).toBe(200);
  });
  it("does not use missing previous rates to hide valid current money", () => {
    const result = prepareReportCurrency({ ...setup, mode: "USD", previousMetrics: [row("c1", 400, "2026-08-01")] });
    expect(result.current.currency).toBe("USD");
    expect(result.previous.currency).toBeNull();
  });
  it("never publishes a partial converted total or invents an unknown currency", () => {
    const result = prepareReportCurrency({ ...setup, mode: "USD", metrics: [row("c1", 400), row("unknown", 20)] });
    expect(result.current.currency).toBeNull();
    expect(result.current.metrics[0].spend).toBe(400);
    expect(prepareReportCurrency({ ...setup, mode: "native", campaignCurrencies: new Map([["c1", null]]) }).current.currency).toBeNull();
  });
  it("uses the selected account currency for an empty period", () => {
    expect(prepareReportCurrency({ ...setup, mode: "native", metrics: [] }).nativeCurrency).toBe("AED");
  });
  it("does not compare different native currencies across periods", () => {
    const result = prepareReportCurrency({ ...setup, mode: "native", previousMetrics: [row("c2", 40)], campaignCurrencies: new Map([["c1", "AED"], ["c2", "GBP"]]) });
    expect(result.current.currency).toBeNull();
    expect(result.previous.currency).toBeNull();
  });
});
