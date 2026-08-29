import { describe, expect, it } from "vitest";

import { summarizeProjectAnalytics } from "@/lib/project-analytics-summary";

const base = {
  projects: [{ id: "project-1", name: "Проект", brand_color: "#2563eb", started_at: "2026-08-20" }],
  campaigns: [{ id: "campaign-1", project_id: "project-1", ad_account_id: "account-1" }],
  accounts: [{ id: "account-1", currency: "RUB", project_id: "project-1" }],
  metrics: [{ campaign_id: "campaign-1", spend: 1_000, impressions: 10_000, clicks: 200 }],
  from: "2026-08-20",
  to: "2026-08-26",
};

describe("summarizeProjectAnalytics", () => {
  it("calculates lead and one-goal costs only within a single project", () => {
    const [summary] = summarizeProjectAnalytics({
      ...base,
      conversions: [
        { campaign_id: "campaign-1", date: "2026-08-20", action_type: "lead", count: 4, value: 0 },
        { campaign_id: "campaign-1", date: "2026-08-20", action_type: "link_click", count: 100, value: 0 },
      ],
      previousMetrics: [{ campaign_id: "campaign-1", spend: 800, impressions: 9_000, clicks: 150 }],
      previousConversions: [{ campaign_id: "campaign-1", date: "2026-08-13", action_type: "lead", count: 4, value: 0 }],
      latestMetricDates: [{ campaign_id: "campaign-1", date: "2026-08-26" }],
    });

    expect(summary).toMatchObject({
      hasData: true, currency: "RUB", spend: 1_000, impressions: 10_000, clicks: 200,
      conversions: 4, goalLabel: "Лиды", costPerLead: 250, costPerGoal: 250,
      costPerLeadDeltaPercent: 25, costPerGoalDeltaPercent: 25, spendDeltaPercent: 25,
    });
  });

  it("does not invent a blended goal cost for different goals or currencies", () => {
    const [summary] = summarizeProjectAnalytics({
      ...base,
      accounts: [{ id: "account-1", currency: "RUB", project_id: "project-1" }, { id: "account-2", currency: "USD", project_id: "project-1" }],
      campaigns: [...base.campaigns, { id: "campaign-2", project_id: "project-1", ad_account_id: "account-2" }],
      metrics: [...base.metrics, { campaign_id: "campaign-2", spend: 50, impressions: 200, clicks: 10 }],
      conversions: [
        { campaign_id: "campaign-1", date: "2026-08-20", action_type: "lead", count: 4, value: 0 },
        { campaign_id: "campaign-2", date: "2026-08-20", action_type: "purchase", count: 1, value: 0 },
      ],
    });

    expect(summary.hasMixedCurrencies).toBe(true);
    expect(summary.hasMultipleGoalTypes).toBe(true);
    expect(summary.costPerGoal).toBeNull();
    expect(summary.costPerLead).toBeNull();
  });

  it("помечает подключённый кабинет без свежих данных", () => {
    const [summary] = summarizeProjectAnalytics({
      ...base,
      metrics: [],
      conversions: [],
      latestMetricDates: [],
    });

    expect(summary.hasData).toBe(false);
    expect(summary.freshnessWarning).toContain("ещё не загружены");
    expect(summary.brandColor).toBe("#2563eb");
  });
});
