import { describe, expect, it } from "vitest";

import { summarizeProjectAnalytics } from "@/lib/project-analytics-summary";

const base = {
  projects: [{ id: "project-1", name: "Проект" }],
  campaigns: [{ id: "campaign-1", project_id: "project-1", ad_account_id: "account-1" }],
  accounts: [{ id: "account-1", currency: "RUB" }],
  metrics: [{ campaign_id: "campaign-1", spend: 1_000, impressions: 10_000, clicks: 200 }],
};

describe("summarizeProjectAnalytics", () => {
  it("calculates lead and one-goal costs only within a single project", () => {
    const [summary] = summarizeProjectAnalytics({
      ...base,
      conversions: [
        { campaign_id: "campaign-1", date: "2026-08-20", action_type: "lead", count: 4, value: 0 },
        { campaign_id: "campaign-1", date: "2026-08-20", action_type: "link_click", count: 100, value: 0 },
      ],
    });

    expect(summary).toMatchObject({
      hasData: true, currency: "RUB", spend: 1_000, impressions: 10_000, clicks: 200,
      conversions: 4, goalLabel: "Лиды", costPerLead: 250, costPerGoal: 250,
    });
  });

  it("does not invent a blended goal cost for different goals or currencies", () => {
    const [summary] = summarizeProjectAnalytics({
      ...base,
      accounts: [{ id: "account-1", currency: "RUB" }, { id: "account-2", currency: "USD" }],
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
});
