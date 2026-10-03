import { describe, expect, it } from "vitest";
import { dailyAdDashboardPoints, percentChange, summarizeAdDashboard } from "@/lib/project-ad-dashboard";

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
});
