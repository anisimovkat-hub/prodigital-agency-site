import { describe, expect, it } from "vitest";

import { buildAdAlerts } from "@/lib/ad-alerts";
import type { ProjectAdMetrics } from "@/lib/dashboard-ad-metrics";

function metric(
  overrides: Partial<ProjectAdMetrics> = {},
): ProjectAdMetrics {
  return {
    currency: "EUR",
    spend: 100,
    impressions: 1000,
    clicks: 50,
    results: 10,
    primaryGoals: [{ actionType: "lead", count: 10 }],
    costPerResult: 10,
    hasMixedGoals: false,
    ...overrides,
  };
}

function build(
  currentRows: ProjectAdMetrics[],
  previousRows: ProjectAdMetrics[],
  latestDate = "2026-08-12",
) {
  return buildAdAlerts({
    projects: [{ id: "p1", name: "Проект" }],
    current: new Map([["p1", currentRows]]),
    previous: new Map([["p1", previousRows]]),
    linkedProjectIds: new Set(["p1"]),
    latestMetricDateByProject: latestDate
      ? new Map([["p1", latestDate]])
      : new Map(),
    today: "2026-08-13",
  });
}

describe("buildAdAlerts", () => {
  it("сигнализирует о росте CPA выше порога", () => {
    const alerts = build([metric({ costPerResult: 15 })], [metric()]);
    expect(alerts.some((alert) => alert.kind === "cost-increase")).toBe(true);
  });

  it("не сравнивает стоимость разных целей", () => {
    const alerts = build(
      [metric({ primaryGoals: [{ actionType: "purchase", count: 10 }], costPerResult: 20 })],
      [metric()],
    );
    expect(alerts.some((alert) => alert.kind === "cost-increase")).toBe(false);
  });

  it("сигнализирует о падении показов", () => {
    const alerts = build(
      [metric({ impressions: 500 })],
      [metric({ impressions: 1000 })],
    );
    expect(alerts.find((alert) => alert.kind === "delivery-drop")?.title).toContain("50%");
  });

  it("отличает неделю расхода без результата от двух недель без результата", () => {
    const oneWeek = build(
      [metric({ results: 0, primaryGoals: [], costPerResult: null })],
      [metric()],
    );
    expect(oneWeek.some((alert) => alert.kind === "spend-without-results")).toBe(true);

    const twoWeeks = build(
      [metric({ results: 0, primaryGoals: [], costPerResult: null })],
      [metric({ results: 0, primaryGoals: [], costPerResult: null })],
    );
    expect(twoWeeks.some((alert) => alert.kind === "no-results")).toBe(true);
  });

  it("показывает отсутствие и устаревание данных", () => {
    expect(build([], [], "").some((alert) => alert.kind === "missing-data")).toBe(true);
    expect(build([], [], "2026-08-08").some((alert) => alert.kind === "stale-data")).toBe(true);
  });

  it("не создаёт алерты для проекта без связанного Meta-кабинета", () => {
    const alerts = buildAdAlerts({
      projects: [{ id: "p1", name: "Проект" }],
      current: new Map(),
      previous: new Map(),
      linkedProjectIds: new Set(),
      latestMetricDateByProject: new Map(),
      today: "2026-08-13",
    });
    expect(alerts).toEqual([]);
  });
});
