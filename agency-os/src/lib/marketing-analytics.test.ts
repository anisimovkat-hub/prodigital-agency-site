import { describe, expect, it } from "vitest";

import {
  buildMarketingInsights,
  formatCompact,
  formatMetricPercent,
  type MarketingPayload,
} from "@/lib/marketing-analytics";

function payload(): MarketingPayload {
  return {
    project: { id: "p1", name: "Проект", logoUrl: null },
    period: { from: "2026-08-01", to: "2026-08-04" },
    organic: { connected: true, accountName: "project", followers: 1000, followerGrowth: 40, reach: 450, impressions: 500, engagements: 45, engagementRate: 0.1, publications: 2, saves: 12, posts: [{ caption: "Reel", mediaType: "VIDEO", imageUrl: null, permalink: null, publishedAt: "2026-08-03T00:00:00Z", reach: 300, views: 400, likes: 20, comments: 4, saved: 8, shares: 3, engagements: 35 }] },
    paid: { connected: true, spend: 300, impressions: 10_000, reach: 7_000, clicks: 200, conversions: 10, conversionValue: 900, ctr: 0.02, cpa: 30, roas: 3, currencies: ["USD"] },
    daily: [
      { date: "2026-08-01", organicReach: 50, paidReach: 1000, spend: 50, engagements: 5, conversions: 5 },
      { date: "2026-08-02", organicReach: 50, paidReach: 1000, spend: 50, engagements: 5, conversions: 5 },
      { date: "2026-08-03", organicReach: 150, paidReach: 2500, spend: 100, engagements: 15, conversions: 2 },
      { date: "2026-08-04", organicReach: 200, paidReach: 2500, spend: 100, engagements: 20, conversions: 2 },
    ],
  };
}

describe("buildMarketingInsights", () => {
  it("формирует выводы по росту, Reels и CPA", () => {
    const insights = buildMarketingInsights(payload());
    expect(insights).toHaveLength(3);
    expect(insights[0].title).toContain("Органический охват");
    expect(insights[1].title).toContain("Reels");
    expect(insights[2].title).toContain("Стоимость результата");
  });

  it("не сравнивает стоимость при смешанных валютах", () => {
    const value = payload();
    value.paid.currencies = ["USD", "EUR"];
    const insights = buildMarketingInsights(value);
    expect(insights.some((item) => item.title.includes("Стоимость результата выросла"))).toBe(false);
  });

  it("даёт пустое состояние без источников", () => {
    const value = payload();
    value.organic.connected = false;
    value.organic.posts = [];
    value.paid.connected = false;
    expect(buildMarketingInsights(value)[0].title).toContain("недостаточно");
  });
});
describe("формат метрик", () => {
  it("форматирует проценты и прочерк", () => {
    expect(formatMetricPercent(0.1234)).toBe("12,34%");
    expect(formatMetricPercent(null)).toBe("—");
  });

  it("сокращает большие числа", () => {
    expect(formatCompact(12_500)).toMatch(/12[,.]5|13/);
  });
});
