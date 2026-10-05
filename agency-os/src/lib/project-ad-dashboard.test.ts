import { describe, expect, it } from "vitest";
import { aggregateAdDashboardPoints, dailyAdDashboardPoints, fillAdDashboardDays, formatAdMoney, formatAdNumber, formatAdPercent, percentChange, summarizeAdDashboard } from "@/lib/project-ad-dashboard";

const ids = new Set(["campaign-a"]);
const metrics = [
  { campaign_id: "campaign-a", date: "2026-10-01", spend: 100, impressions: 1000, clicks: 50 },
  { campaign_id: "campaign-b", date: "2026-10-01", spend: 900, impressions: 9000, clicks: 500 },
];
const conversions = [
  { campaign_id: "campaign-a", date: "2026-10-01", action_type: "lead", count: 5 },
  { campaign_id: "campaign-a", date: "2026-10-01", action_type: "purchase", count: 1 },
];

describe("project ad dashboard", () => {
  it("uses one campaign and one selected goal", () => {
    expect(summarizeAdDashboard(metrics, conversions, ids, "lead", true)).toMatchObject({ spend: 100, conversions: 5, cpa: 20 });
    expect(dailyAdDashboardPoints(metrics, conversions, ids, "lead")).toMatchObject([{ spend: 100, conversions: 5 }]);
  });
  it("does not manufacture a goal or mixed-currency CPA", () => {
    expect(summarizeAdDashboard(metrics, conversions, ids, null, true).conversions).toBeNull();
    expect(summarizeAdDashboard(metrics, conversions, ids, "lead", false).cpa).toBeNull();
  });
  it("does not claim a percentage from an empty baseline", () => {
    expect(percentChange(20, 10)).toBe(1);
    expect(percentChange(20, 0)).toBeNull();
  });
  it("sums weekly spend and results before computing a weighted CPA", () => {
    const points = aggregateAdDashboardPoints([
      { bucket: "2026-10-01", spend: 100, conversions: 5, impressions: 1000, clicks: 50, conv_value: 0 },
      { bucket: "2026-10-02", spend: 400, conversions: 10, impressions: 2000, clicks: 100, conv_value: 0 },
      { bucket: "2026-10-05", spend: 50, conversions: 1, impressions: 500, clicks: 20, conv_value: 0 },
    ], "week");
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ bucket: "2026-09-28", spend: 500, conversions: 15 });
    expect(points[0].spend / points[0].conversions).toBeCloseTo(33.3333);
  });
});

describe("fillAdDashboardDays", () => {
  it("adds empty days inside the period and keeps existing values", () => {
    const filled = fillAdDashboardDays([{ bucket: "2026-10-02", spend: 5, impressions: 1, clicks: 0, conversions: 2, conv_value: 0 }], "2026-10-01", "2026-10-03");
    expect(filled.map((point) => [point.bucket, point.conversions])).toEqual([["2026-10-01", 0], ["2026-10-02", 2], ["2026-10-03", 0]]);
  });
});

describe("ad formatting", () => {
  it("groups thousands with a non-breaking space and places currency signs", () => {
    expect(formatAdNumber(59640)).toBe("59 640");
    expect(formatAdMoney(1420, "RUB")).toBe("1 420 ₽");
    expect(formatAdMoney(12.5, "USD")).toBe("$12,5");
    expect(formatAdMoney(862632, "IDR")).toBe("862 632 IDR");
    expect(formatAdPercent(-0.24)).toBe("24%");
    expect(formatAdPercent(0.054)).toBe("5,4%");
    expect(formatAdPercent(106)).toBe("×107");
    expect(formatAdPercent(2.5)).toBe("×3,5");
  });
});
