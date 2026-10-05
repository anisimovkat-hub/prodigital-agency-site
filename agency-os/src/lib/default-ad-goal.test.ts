import { describe, expect, it } from "vitest";

import { selectDefaultAdGoal } from "@/lib/default-ad-goal";

const goals = [
  { value: "lead", label: "Лиды" },
  { value: "thanks", label: "Страница Спасибо (новый сайт)" },
  { value: "message", label: "Начатые переписки" },
];
const conversions = [
  { campaign_id: "a", date: "2026-09-01", action_type: "lead", count: 90 },
  { campaign_id: "a", date: "2026-09-01", action_type: "thanks", count: 42 },
  { campaign_id: "b", date: "2026-09-01", action_type: "message", count: 100 },
];

describe("selectDefaultAdGoal", () => {
  it("prefers a named outcome over aggregate actions", () => {
    expect(selectDefaultAdGoal("", goals, conversions, new Set(["a"]))).toBe("thanks");
  });
  it("keeps an explicitly selected goal", () => {
    expect(selectDefaultAdGoal("message", goals, conversions, new Set(["a", "b"]))).toBe("message");
  });
  it("only considers campaigns in the current view", () => {
    expect(selectDefaultAdGoal("", goals, conversions, new Set(["b"]))).toBe("message");
  });
  it("does not fabricate a result when there are no conversions", () => {
    expect(selectDefaultAdGoal("", goals, [], new Set(["a"]))).toBeNull();
  });
});
