import { describe, expect, it } from "vitest";

import {
  calculateMediaPlanFact,
  type MediaPlanMetricDefinition,
} from "@/lib/media-plan-fact";

const metrics: MediaPlanMetricDefinition[] = [
  { id: "1", metric_key: "spend", label: "Бюджет", target_value: 1000, unit: "money", conversion_action_type: null, campaign_id: null, sort_order: 0, notes: null },
  { id: "2", metric_key: "clicks", label: "Клики", target_value: 200, unit: "count", conversion_action_type: null, campaign_id: null, sort_order: 1, notes: null },
  { id: "3", metric_key: "conversion:lead", label: "Лиды", target_value: 10, unit: "count", conversion_action_type: "lead", campaign_id: "campaign-rub", sort_order: 2, notes: null },
  { id: "4", metric_key: "revenue", label: "Выручка", target_value: 5000, unit: "money", conversion_action_type: null, campaign_id: null, sort_order: 3, notes: null },
];

describe("calculateMediaPlanFact", () => {
  it("считает базовые метрики и точную конверсию в валюте плана", () => {
    const result = calculateMediaPlanFact({
      projectId: "project",
      currency: "RUB",
      metrics,
      accounts: [
        { id: "account-rub", project_id: "project", currency: "RUB" },
        { id: "account-usd", project_id: "project", currency: "USD" },
      ],
      campaigns: [
        { id: "campaign-rub", project_id: "project", ad_account_id: "account-rub" },
        { id: "campaign-usd", project_id: "project", ad_account_id: "account-usd" },
      ],
      campaignMetrics: [
        { campaign_id: "campaign-rub", spend: 750, impressions: 10000, clicks: 150, reach: 8000 },
        { campaign_id: "campaign-usd", spend: 100, impressions: 2000, clicks: 50, reach: 1800 },
      ],
      conversions: [
        { campaign_id: "campaign-rub", action_type: "lead", count: 8, value: 0 },
        { campaign_id: "campaign-rub", date: "2026-08-01", action_type: "purchase", count: 2, value: 4200 },
        { campaign_id: "campaign-rub", date: "2026-08-01", action_type: "omni_purchase", count: 2, value: 4200 },
        { campaign_id: "campaign-usd", action_type: "lead", count: 9, value: 0 },
      ],
    });

    expect(result.map((row) => [row.metric_key, row.factValue])).toEqual([
      ["spend", 750],
      ["clicks", 150],
      ["conversion:lead", 8],
      ["revenue", 4200],
    ]);
    expect(result[0]?.completion).toBe(0.75);
    expect(result.every((row) => !row.currencyMismatch)).toBe(true);
  });

  it("не смешивает другую валюту и помечает ошибочную кампанию", () => {
    const result = calculateMediaPlanFact({
      projectId: "project",
      currency: "RUB",
      metrics: [{ ...metrics[2]!, campaign_id: "campaign-usd" }],
      accounts: [{ id: "account-usd", project_id: "project", currency: "USD" }],
      campaigns: [{ id: "campaign-usd", project_id: null, ad_account_id: "account-usd" }],
      campaignMetrics: [],
      conversions: [{ campaign_id: "campaign-usd", action_type: "lead", count: 20, value: 0 }],
    });

    expect(result[0]).toMatchObject({ factValue: 0, currencyMismatch: true });
  });

  it("не делит на ноль при нулевом плане", () => {
    const result = calculateMediaPlanFact({
      projectId: "project",
      currency: "RUB",
      metrics: [{ ...metrics[1]!, target_value: 0 }],
      accounts: [],
      campaigns: [],
      campaignMetrics: [],
      conversions: [],
    });

    expect(result[0]?.completion).toBeNull();
    expect(result[0]?.variance).toBe(0);
  });
});
