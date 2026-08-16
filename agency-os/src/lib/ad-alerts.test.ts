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
) {
  return buildAdAlerts({
    projects: [{ id: "p1", name: "Проект" }],
    current: new Map([["p1", currentRows]]),
    previous: new Map([["p1", previousRows]]),
    linkedProjectIds: new Set(["p1"]),
  });
}

describe("buildAdAlerts", () => {
  it("сигнализирует, когда CPA вырос минимум на 20% и заявок стало меньше", () => {
    const alerts = build(
      [
        metric({
          results: 8,
          primaryGoals: [{ actionType: "lead", count: 8 }],
          costPerResult: 12,
        }),
      ],
      [metric()],
    );
    expect(alerts.some((alert) => alert.kind === "cost-increase")).toBe(true);
  });

  it("не тревожит только из-за роста CPA, если заявок не стало меньше", () => {
    const alerts = build([metric({ costPerResult: 15 })], [metric()]);
    expect(alerts.some((alert) => alert.kind === "cost-increase")).toBe(false);
  });

  it("не сравнивает стоимость разных целей", () => {
    const alerts = build(
      [metric({ primaryGoals: [{ actionType: "purchase", count: 10 }], costPerResult: 20 })],
      [metric()],
    );
    expect(alerts.some((alert) => alert.kind === "cost-increase")).toBe(false);
  });

  it("не сигнализирует о падении показов", () => {
    const alerts = build(
      [metric({ impressions: 500 })],
      [metric({ impressions: 1000 })],
    );
    expect(alerts).toEqual([]);
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

  it("не выводит тревоги о технической свежести данных", () => {
    expect(build([], [])).toEqual([]);
  });

  it("не создаёт алерты для проекта без связанного Meta-кабинета", () => {
    const alerts = buildAdAlerts({
      projects: [{ id: "p1", name: "Проект" }],
      current: new Map(),
      previous: new Map(),
      linkedProjectIds: new Set(),
    });
    expect(alerts).toEqual([]);
  });
});
