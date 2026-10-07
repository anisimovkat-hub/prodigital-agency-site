import { describe, expect, it } from "vitest";

import { attributeCampaignGoals, buildGoalCards, goalDailyPoints } from "@/lib/project-ad-goals";

const campaigns = [
  { id: "lead", platform: "meta", objective: "OUTCOME_LEADS", optimization_goal: "LEAD_GENERATION" },
  { id: "sale", platform: "meta", objective: "OUTCOME_SALES", optimization_goal: "OFFSITE_CONVERSIONS:PURCHASE" },
  { id: "traffic", platform: "meta", objective: "OUTCOME_TRAFFIC", optimization_goal: "PROFILE_VISIT" },
];
const metrics = [
  { campaign_id: "lead", date: "2026-10-01", spend: 100, impressions: 1000, clicks: 10 },
  { campaign_id: "sale", date: "2026-10-01", spend: 300, impressions: 2000, clicks: 20 },
  { campaign_id: "traffic", date: "2026-10-01", spend: 50, impressions: 5000, clicks: 90 },
];
const conversions = [
  { campaign_id: "lead", date: "2026-10-01", action_type: "lead", count: 10 },
  { campaign_id: "sale", date: "2026-10-01", action_type: "purchase", count: 3 },
  { campaign_id: "sale", date: "2026-10-01", action_type: "add_to_cart", count: 12 },
  { campaign_id: "sale", date: "2026-10-01", action_type: "lead", count: 1 },
  { campaign_id: "traffic", date: "2026-10-01", action_type: "instagram_profile_visit", count: 80 },
];
const goals = attributeCampaignGoals(campaigns, conversions);
const selected = new Set(campaigns.map((campaign) => campaign.id));

describe("buildGoalCards", () => {
  it('does not attribute Yandex by whichever technical goal is largest', () => {
    expect(attributeCampaignGoals([{ id: 'ya', platform: 'yandex_direct', objective: null, optimization_goal: null }], [{ campaign_id: 'ya', date: '2026-10-01', action_type: 'yandex:conversions', count: 739 }]).get('ya')).toBeNull();
  });
  it('separates explicit Yandex goals and preserves zero versus missing data', () => {
    const args = { selected: new Set(['lead']), goals: new Map(), settings: [], metrics: [metrics[0]], conversions: [
      { campaign_id: 'lead', date: '2026-10-01', action_type: 'yandex_goal:42:LC', count: 2, is_measured: true },
      { campaign_id: 'lead', date: '2026-10-01', action_type: 'yandex_goal:43:LC', count: 0, is_measured: true },
      { campaign_id: 'lead', date: '2026-10-01', action_type: 'yandex:conversions', count: 739 },
    ], previousMetrics: [metrics[0]], previousConversions: [], yandexGoals: [
      { id: '42', name: 'Спасибо', domain: 'site.ru', counterId: '123', campaignIds: ['lead'] },
      { id: '43', name: 'Звонок', domain: 'site.ru', counterId: '123', campaignIds: ['lead'] },
    ] };
    const cards = buildGoalCards(args);
    expect(cards[0].current).toEqual({ results: 2, spend: 100, cpa: 50, complete: true });
    expect(cards[1].current).toEqual({ results: 0, spend: 100, cpa: null, complete: true });
    expect(cards[0].previous.complete).toBe(false);
    expect(goalDailyPoints(args.metrics, args.conversions, cards[0], args.goals)[0].conversions).toBe(2);
    const incomplete = buildGoalCards({ ...args, metrics: [...args.metrics, { ...metrics[0], date: '2026-10-02' }] });
    expect(incomplete[0].current).toMatchObject({ complete: false, cpa: null });
  });
  it("prices each goal only by the spend of its own campaigns", () => {
    const cards = buildGoalCards({ selected, goals, settings: [], metrics, conversions, previousMetrics: [], previousConversions: [] });
    expect(cards.map((card) => [card.label, card.current.results, card.current.spend, card.current.cpa])).toEqual([
      ["Покупки", 3, 300, 100],
      ["Лиды", 10, 100, 10],
      ["Переходы в профиль", 80, 50, 0.625],
    ]);
  });

  it("adds an extra goal counted across all campaigns without a price", () => {
    const cards = buildGoalCards({ selected, goals, settings: [{ goal_key: "cart", label: "Корзина", hidden: false, extra: true }], metrics, conversions, previousMetrics: [], previousConversions: [] });
    expect(cards.at(-1)).toMatchObject({ label: "Корзина", extra: true, current: { results: 12, cpa: null } });
  });

  it("hides and renames goals from project settings", () => {
    const cards = buildGoalCards({ selected, goals, settings: [{ goal_key: "profile", label: null, hidden: true, extra: false }, { goal_key: "leads", label: "Заявки", hidden: false, extra: false }], metrics, conversions, previousMetrics: [], previousConversions: [] });
    expect(cards.map((card) => card.label)).toEqual(["Покупки", "Заявки"]);
  });

  it("drops goals whose campaigns did nothing in the period", () => {
    const idle = buildGoalCards({ selected, goals, settings: [], metrics: metrics.filter((row) => row.campaign_id !== "lead"), conversions: conversions.filter((row) => row.campaign_id !== "lead"), previousMetrics: [], previousConversions: [] });
    expect(idle.map((card) => card.key)).not.toContain("leads");
  });
  it("keeps an inactive goal available for saved dashboard cards when requested", () => {
    const cards = buildGoalCards({ selected, goals, settings: [], metrics: [], conversions: [], previousMetrics: [], previousConversions: [], includeInactive: true });
    expect(cards.find((card) => card.key === "leads")?.current).toEqual({ results: 0, spend: 0, cpa: null });
  });
});

describe("goalDailyPoints", () => {
  it("counts each campaign's own action and its spend", () => {
    const [leads] = buildGoalCards({ selected: new Set(["lead", "sale"]), goals, settings: [], metrics, conversions, previousMetrics: [], previousConversions: [] }).filter((card) => card.key === "leads");
    expect(goalDailyPoints(metrics, conversions, leads, goals)).toEqual([{ bucket: "2026-10-01", spend: 100, impressions: 1000, clicks: 10, conversions: 10, conv_value: 0 }]);
  });
});
