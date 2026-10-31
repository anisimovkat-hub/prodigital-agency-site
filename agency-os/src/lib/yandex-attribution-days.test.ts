import { describe, expect, it } from "vitest";
import { mergeYandexAttributionDays, yandexCampaignDays } from "./yandex-attribution-days";

const row = { campaignId: "101", campaignName: "Tools", date: "2026-10-27", cost: 0, impressions: 100, clicks: 5, conversions: null,
  goals: { "3071291494": 0 }, goalValues: { "3071291494": 0 } };
describe("separate Yandex attribution storage", () => {
  it("retains LC and LSCCD as separate actions with one traffic snapshot", () => {
    const days = mergeYandexAttributionDays(yandexCampaignDays([row]), yandexCampaignDays([{ ...row, goals: { "3071291494": 2 } }], "LSCCD"));
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ spend: 0, clicks: 5, impressions: 100, goalResults: [
      { action: "yandex_goal:3071291494:LC", count: 0 }, { action: "yandex_goal:3071291494:LSCCD", count: 2 },
    ] });
  });
  it("keeps unknown AUTO separate from measured LC zero", () => {
    const days = mergeYandexAttributionDays(yandexCampaignDays([row]), yandexCampaignDays([{ ...row, goals: { "3071291494": null }, goalValues: { "3071291494": null } }], "AUTO"));
    expect(days[0].goalResults?.map((goal) => [goal.action, goal.count, goal.value])).toEqual([
      ["yandex_goal:3071291494:LC", 0, 0], ["yandex_goal:3071291494:AUTO", null, null],
    ]);
  });
  it("rejects missing model data, duplicate actions and changed completed-day traffic", () => {
    const lc = yandexCampaignDays([row]);
    expect(() => mergeYandexAttributionDays(lc, [])).toThrow("Неполное покрытие");
    expect(() => mergeYandexAttributionDays(lc, lc)).toThrow("Повторная цель");
    expect(() => mergeYandexAttributionDays(lc, yandexCampaignDays([{ ...row, clicks: 6 }], "LSCCD"))).toThrow("Метрики");
    expect(() => mergeYandexAttributionDays([...lc, ...lc], [])).toThrow("Повторная строка");
  });
});
