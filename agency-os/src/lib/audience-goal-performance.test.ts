import { describe, expect, it } from "vitest";
import { summarizeAudienceGoal } from "@/lib/audience-goal-performance";

describe("audience goal performance", () => {
  it("uses only the selected goal and source-matched spend", () => {
    const rows = [
      { breakdown: "country" as const, value: "RU", spend: 60, conversion_actions: [{ actionType: "lead", count: 3 }, { actionType: "purchase", count: 1 }] },
      { breakdown: "country" as const, value: "RU", spend: 40, conversion_actions: [{ actionType: "lead", count: 2 }] },
    ];
    expect(summarizeAudienceGoal(rows, "country", "lead")).toEqual([{ value: "RU", spend: 100, results: 5, cpa: 20, complete: true }]);
  });
  it("does not pretend missing actions are zero conversions", () => {
    expect(summarizeAudienceGoal([{ breakdown: "age", value: "25-34", spend: 100, conversion_actions: null }], "age", "lead")[0]).toMatchObject({ complete: false, cpa: null, results: null });
  });
});
