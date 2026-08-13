import { describe, expect, it } from "vitest";

import {
  aggregateProjectAdMetrics,
  formatAdMoney,
  latestProjectAdMetricDates,
  linkedAdProjectIds,
  precedingDateRange,
  rollingDateRange,
  summarizeProjectAdDelivery,
  type DashboardCampaignPeriodRow,
} from "@/lib/dashboard-ad-metrics";

const accounts = [
  { id: "a-rub", project_id: "p1", currency: "rub" },
  { id: "a-eur", project_id: "p1", currency: "EUR" },
  { id: "a-hidden", project_id: "hidden", currency: "USD" },
];

const campaigns = [
  { id: "c1", ad_account_id: "a-rub", project_id: null },
  { id: "c2", ad_account_id: "a-eur", project_id: null },
  { id: "c3", ad_account_id: "a-rub", project_id: "p2" },
  { id: "c-hidden", ad_account_id: "a-hidden", project_id: null },
];

function row(
  campaign_id: string,
  spend: number,
  action_type = "lead",
  count = 0,
): DashboardCampaignPeriodRow {
  return {
    campaign_id,
    spend,
    impressions: 1000,
    clicks: 50,
    conversions: count
      ? [{ action_type, count, value: 0 }]
      : [],
  };
}

describe("rollingDateRange", () => {
  it("включает текущий день в последние 7 календарных дней", () => {
    expect(rollingDateRange("2026-08-13", 7)).toEqual({
      since: "2026-08-07",
      until: "2026-08-13",
    });
  });

  it("строит предыдущий период той же длины без пересечения", () => {
    expect(
      precedingDateRange({ since: "2026-08-07", until: "2026-08-13" }),
    ).toEqual({ since: "2026-07-31", until: "2026-08-06" });
  });
});

describe("aggregateProjectAdMetrics", () => {
  it("разделяет деньги разных валют", () => {
    const result = aggregateProjectAdMetrics(
      accounts,
      campaigns,
      [row("c1", 100, "lead", 5), row("c2", 20, "purchase", 2)],
      new Set(["p1"]),
    );
    expect(result.get("p1")?.map((item) => [item.currency, item.spend])).toEqual([
      ["EUR", 20],
      ["RUB", 100],
    ]);
  });

  it("кампания может переопределить проект рекламного кабинета", () => {
    const result = aggregateProjectAdMetrics(
      accounts,
      campaigns,
      [row("c3", 75, "lead", 3)],
      new Set(["p1", "p2"]),
    );
    expect(result.has("p1")).toBe(false);
    expect(result.get("p2")?.[0].spend).toBe(75);
  });

  it("не отдаёт метрики проектов, которых нет в доступном RLS-наборе", () => {
    const result = aggregateProjectAdMetrics(
      accounts,
      campaigns,
      [row("c-hidden", 500, "lead", 10)],
      new Set(["p1"]),
    );
    expect(result.size).toBe(0);
  });

  it("не удваивает lead его пиксельным вариантом и считает стоимость результата", () => {
    const result = aggregateProjectAdMetrics(
      accounts,
      campaigns,
      [{
        ...row("c1", 120),
        conversions: [
          { action_type: "lead", count: 6, value: 0 },
          { action_type: "offsite_conversion.fb_pixel_lead", count: 6, value: 0 },
        ],
      }],
      new Set(["p1"]),
    );
    expect(result.get("p1")?.[0].results).toBe(6);
    expect(result.get("p1")?.[0].costPerResult).toBe(20);
  });

  it("не выводит обманчивый общий CPA для разных целей", () => {
    const result = aggregateProjectAdMetrics(
      accounts,
      campaigns,
      [row("c1", 100, "lead", 5), row("c1", 40, "purchase", 2)],
      new Set(["p1"]),
    );
    expect(result.get("p1")?.[0].hasMixedGoals).toBe(true);
    expect(result.get("p1")?.[0].costPerResult).toBeNull();
  });
});

describe("formatAdMoney", () => {
  it("сохраняет валюту в подписи", () => {
    expect(formatAdMoney(12.5, "EUR")).toContain("€");
    expect(formatAdMoney(12.5, null)).toContain("валюта не указана");
  });
});

describe("project ad links and freshness", () => {
  it("учитывает прямую привязку кабинета и override кампании", () => {
    expect(
      [...linkedAdProjectIds(accounts, campaigns, new Set(["p1", "p2"]))].sort(),
    ).toEqual(["p1", "p2"]);
  });

  it("находит последнюю дату метрик только видимых проектов", () => {
    expect(
      latestProjectAdMetricDates(
        accounts,
        campaigns,
        [
          { campaign_id: "c1", date: "2026-08-10" },
          { campaign_id: "c1", date: "2026-08-12" },
          { campaign_id: "c3", date: "2026-08-11" },
          { campaign_id: "c-hidden", date: "2026-08-13" },
        ],
        new Set(["p1", "p2"]),
      ),
    ).toEqual(new Map([["p1", "2026-08-12"], ["p2", "2026-08-11"]]));
  });
});

describe("summarizeProjectAdDelivery", () => {
  it("складывает неденежные показатели и сохраняет разбивку целей", () => {
    const result = aggregateProjectAdMetrics(
      accounts,
      campaigns,
      [row("c1", 100, "lead", 5), row("c2", 20, "purchase", 2)],
      new Set(["p1"]),
    );
    expect(summarizeProjectAdDelivery(result.get("p1") ?? [])).toEqual({
      impressions: 2000,
      clicks: 100,
      goals: [
        { actionType: "lead", count: 5 },
        { actionType: "purchase", count: 2 },
      ],
    });
  });
});
