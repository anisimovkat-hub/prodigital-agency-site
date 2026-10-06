import { describe, expect, it } from "vitest";
import { buildDashboardMetrics, dashboardStorageKey, goalMetricId, goalPriceLabel, mandatoryMetricIds, parseMetricSelection, visibleMetricIds } from "@/lib/ad-dashboard-metrics";
import type { GoalCard } from "@/lib/project-ad-goals";

const lead: GoalCard = { key: "leads", label: "Лиды", extra: false, campaignIds: new Set(["lead"]),
  current: { results: 10, spend: 200, cpa: 20 }, previous: { results: 5, spend: 150, cpa: 30 } };
const subscription: GoalCard = { key: "subscriptions", label: "Подписки", extra: false, campaignIds: new Set(["follow"]),
  current: { results: 20, spend: 100, cpa: 5 }, previous: { results: 10, spend: 60, cpa: 6 } };
const input = { cards: [lead], defaultGoals: new Set(["leads"]), hasData: true, currency: "USD", previousCurrency: "USD",
  spend: 300, previousSpend: 210, impressions: 3000, previousImpressions: 2000, clicks: 60, previousClicks: 70 };
const byId = (id: string, value = input) => buildDashboardMetrics(value).find((item) => item.id === id)!;

describe("dashboard metrics", () => {
  it("always starts with spend, result count and a separate goal price", () => {
    const options = buildDashboardMetrics(input);
    expect(visibleMetricIds(options, null, mandatoryMetricIds("leads"))).toEqual(["spend", "goal:leads:results", "goal:leads:price"]);
    expect(byId("goal:leads:price")).toMatchObject({ label: "Цена лида", value: 20, lowerIsBetter: true });
  });
  it("compares counts and prices separately, never using CPA change under lead count", () => {
    expect(byId("goal:leads:results").delta).toBe(1);
    expect(byId("goal:leads:price").delta).toBeCloseTo(-1 / 3);
    expect(byId("goal:leads:results").lowerIsBetter).toBeUndefined();
  });
  it("shows independent quantities and prices for two different goals", () => {
    const metrics = buildDashboardMetrics({ ...input, cards: [lead, subscription], defaultGoals: new Set(["leads", "subscriptions"]) });
    expect(metrics.filter((item) => item.defaultVisible).map((item) => [item.label, item.value])).toEqual([
      ["Расход", 300], ["Лиды", 10], ["Цена лида", 20], ["Подписки", 20], ["Цена подписки", 5],
    ]);
  });
  it("does not assign all project spend to an additional goal", () => {
    const extra = { ...subscription, extra: true, current: { results: 20, spend: 0, cpa: null } };
    const metrics = buildDashboardMetrics({ ...input, cards: [lead, extra] });
    expect(metrics.find((item) => item.id === goalMetricId("subscriptions", "results"))?.value).toBe(20);
    expect(metrics.find((item) => item.id === goalMetricId("subscriptions", "price"))).toMatchObject({ value: null, note: "Нет кампаний на эту цель — отдельной цены нет" });
  });
  it("computes CPM, CPC and CTR from totals, not averages of campaign ratios", () => {
    expect(byId("cpm").value).toBe(100);
    expect(byId("cpc").value).toBe(5);
    expect(byId("ctr").value).toBe(2);
  });
  it("never divides by zero", () => {
    const value = { ...input, impressions: 0, clicks: 0 };
    for (const id of ["cpm", "cpc", "ctr"]) expect(byId(id, value).value).toBeNull();
  });
  it("keeps result counts when currencies cannot be combined", () => {
    const value = { ...input, currency: null as string | null };
    const options = buildDashboardMetrics(value);
    expect(options.find((item) => item.id === "goal:leads:results")?.value).toBe(10);
    for (const id of ["spend", "cpm", "cpc", "goal:leads:price"]) expect(options.find((item) => item.id === id)?.value).toBeNull();
  });
  it("missing previous FX blocks monetary comparisons, not count comparisons", () => {
    const options = buildDashboardMetrics({ ...input, previousCurrency: null });
    expect(options.find((item) => item.id === "goal:leads:results")?.delta).toBe(1);
    for (const id of ["spend", "cpm", "cpc", "goal:leads:price"]) expect(options.find((item) => item.id === id)?.delta).toBeNull();
  });
  it("does not present absent data as real zero results", () => {
    expect(buildDashboardMetrics({ ...input, hasData: false }).every((item) => item.value === null)).toBe(true);
    expect(buildDashboardMetrics({ ...input, cards: [] }).filter((item) => item.defaultVisible).map((item) => item.label)).toEqual(["Расход", "Конверсии", "Цена конверсии"]);
  });
  it("respects custom goal labels", () => {
    expect(goalPriceLabel({ key: "leads", label: "Качественные заявки" })).toBe("Цена: Качественные заявки");
    expect(goalPriceLabel({ key: "custom:42", label: "Оценка квартиры" })).toBe("Цена: Оценка квартиры");
  });
});

describe("metric selection", () => {
  it("never lets saved preferences hide the three current mandatory metrics", () => {
    const options = buildDashboardMetrics(input);
    expect(visibleMetricIds(options, ["cpm", "not-existing"], mandatoryMetricIds("leads"))).toEqual(["spend", "goal:leads:results", "goal:leads:price", "cpm"]);
  });
  it("supports custom conversion IDs containing colons without parsing them", () => {
    expect(goalMetricId("custom:42", "price")).toBe("goal:custom:42:price");
    expect(parseMetricSelection('["goal:custom:42:price","goal:custom:42:price"]')).toEqual(["goal:custom:42:price"]);
  });
  it.each([null, "{", '{}', '[1]', JSON.stringify(Array(101).fill("cpm"))])("safely ignores broken browser preferences: %s", (raw) => {
    expect(parseMetricSelection(raw)).toBeNull();
  });
  it("separates users and projects without storing business metrics", () => {
    expect(dashboardStorageKey("owner", "p1")).not.toBe(dashboardStorageKey("owner", "p2"));
    expect(dashboardStorageKey("owner", "p1")).not.toBe(dashboardStorageKey("other", "p1"));
  });
});
