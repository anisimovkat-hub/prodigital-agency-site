import { describe, expect, it } from "vitest";

import {
  actionTypeLabel,
  isGoalAction,
  pickPrimaryGoal,
  summarizeCampaigns,
  type ConversionRow,
} from "@/lib/ad-analytics";

function conv(
  campaign_id: string,
  action_type: string,
  count: number,
  value = 0,
): ConversionRow {
  return { campaign_id, action_type, count, value };
}

describe("actionTypeLabel", () => {
  it("переводит известные цели на русский", () => {
    expect(actionTypeLabel("lead")).toBe("Лиды");
    expect(actionTypeLabel("offsite_conversion.fb_pixel_lead")).toBe(
      "Лиды (пиксель)",
    );
  });

  it("показывает id кастомной конверсии пикселя", () => {
    expect(actionTypeLabel("offsite_conversion.custom.1234567890")).toBe(
      "Своя конверсия 1234567890",
    );
  });

  it("незнакомый тип отдаёт как есть", () => {
    expect(actionTypeLabel("some_new_action")).toBe("some_new_action");
  });
});

describe("isGoalAction", () => {
  it("цели отличаются от вовлечения", () => {
    expect(isGoalAction("lead")).toBe(true);
    expect(isGoalAction("purchase")).toBe(true);
    expect(isGoalAction("offsite_conversion.custom.42")).toBe(true);
    expect(isGoalAction("link_click")).toBe(false);
    expect(isGoalAction("video_view")).toBe(false);
  });
});

describe("pickPrimaryGoal", () => {
  it("агрегирующий lead важнее пиксельного варианта (иначе двойной счёт)", () => {
    const primary = pickPrimaryGoal([
      { actionType: "offsite_conversion.fb_pixel_lead", count: 12, value: 0 },
      { actionType: "lead", count: 12, value: 0 },
    ]);
    expect(primary?.actionType).toBe("lead");
  });

  it("нулевые цели игнорируются", () => {
    const primary = pickPrimaryGoal([
      { actionType: "lead", count: 0, value: 0 },
      { actionType: "purchase", count: 3, value: 900 },
    ]);
    expect(primary?.actionType).toBe("purchase");
  });

  it("без конверсий возвращает null", () => {
    expect(pickPrimaryGoal([])).toBeNull();
    expect(
      pickPrimaryGoal([{ actionType: "lead", count: 0, value: 0 }]),
    ).toBeNull();
  });

  it("среди неизвестных целей выигрывает более частая", () => {
    const primary = pickPrimaryGoal([
      { actionType: "offsite_conversion.custom.1", count: 2, value: 0 },
      { actionType: "offsite_conversion.custom.2", count: 9, value: 0 },
    ]);
    expect(primary?.actionType).toBe("offsite_conversion.custom.2");
  });
});

describe("summarizeCampaigns", () => {
  const metrics = [
    { campaign_id: "c1", spend: 100, impressions: 1000, clicks: 50 },
    { campaign_id: "c1", spend: 50, impressions: 1000, clicks: 30 },
    { campaign_id: "c2", spend: 200, impressions: 4000, clicks: 40 },
  ];
  const conversions = [
    conv("c1", "lead", 3),
    conv("c1", "lead", 2),
    conv("c1", "link_click", 40),
    conv("c2", "purchase", 4, 1200),
  ];

  it("суммирует расход и клики по дням", () => {
    const summary = summarizeCampaigns(metrics, conversions);
    expect(summary.get("c1")?.spend).toBe(150);
    expect(summary.get("c1")?.clicks).toBe(80);
    expect(summary.get("c1")?.ctr).toBeCloseTo(0.04);
  });

  it("складывает конверсии по цели и считает CPA по главной", () => {
    const summary = summarizeCampaigns(metrics, conversions);
    const c1 = summary.get("c1");
    expect(c1?.primaryGoal).toEqual({ actionType: "lead", count: 5, value: 0 });
    expect(c1?.cpa).toBe(30);
    expect(c1?.goals).toHaveLength(1);
    expect(c1?.otherActions.map((a) => a.actionType)).toEqual(["link_click"]);
  });

  it("сохраняет денежную ценность конверсий", () => {
    const summary = summarizeCampaigns(metrics, conversions);
    expect(summary.get("c2")?.primaryGoal?.value).toBe(1200);
    expect(summary.get("c2")?.cpa).toBe(50);
  });

  it("кампания без конверсий остаётся с расходом и CPA = null", () => {
    const summary = summarizeCampaigns(
      [{ campaign_id: "c3", spend: 70, impressions: 0, clicks: 0 }],
      [],
    );
    expect(summary.get("c3")?.spend).toBe(70);
    expect(summary.get("c3")?.cpa).toBeNull();
    expect(summary.get("c3")?.ctr).toBeNull();
  });
});
