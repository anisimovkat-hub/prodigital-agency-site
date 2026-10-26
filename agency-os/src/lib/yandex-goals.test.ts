import { describe, expect, it } from 'vitest';
import { chooseYandexSyncGoals, directionCampaigns, directionHasGoal, directionReportHref, parseYandexGoals, yandexGoalLabel, type AdDirection } from './yandex-goals';
import { buildGoalCards } from './project-ad-goals';

describe('Yandex direction configuration', () => {
  it('uses explicit project campaigns, not all campaigns sharing a counter', () => {
    const direction: AdDirection = { id: 'd', project_id: 'p', name: 'Ремонт', counter_ids: ['123'], websites: [], campaign_ids: ['a','foreign'], primary_goal: null, is_active: true };
    expect([...directionCampaigns(direction, [{ id: 'a', project_id: 'p' }, { id: 'b', project_id: 'p' }, { id: 'foreign', project_id: 'other' }])]).toEqual(['a']);
  });
  it('keeps identical goal names distinct by verified counter IDs', () => {
    expect(yandexGoalLabel({ id:'42', name:'Форма', domain:'site.ru', counterId:'123' })).toBe('Форма · № 123');
    expect(parseYandexGoals([{ id:'42', name:'Форма', counterId:'123' }, { id:'invalid', name:'bad' }])).toHaveLength(1);
    expect(parseYandexGoals(null)).toEqual([]);
  });

  it('does not include a foreign counter even when its hostname or configured primary goal matches', () => {
    const direction: AdDirection = { id: 'd', project_id: 'p', name: 'Камни', counter_ids: ['123'], websites: ['https://shared.ru/stones/'], campaign_ids: ['stones'], primary_goal: 'yandex:42', is_active: true };
    expect(directionHasGoal(direction, { id: '42', name: 'Покупка', domain: 'shared.ru', counterId: '456' })).toBe(false);
    expect(directionHasGoal(direction, { id: '43', name: 'Покупка', domain: 'other.ru', counterId: '123' })).toBe(true);
    expect(directionHasGoal(direction, { id: '44', name: 'Форма', domain: 'shared.ru', counterId: null })).toBe(true);
    expect(directionHasGoal(direction, { id: '45', name: 'Форма', domain: 'foreign.ru', counterId: null })).toBe(false);
  });

  it('keeps spend and purchases separate for two directions in one account', () => {
    const campaigns = [{ id: 'stones', project_id: 'p' }, { id: 'tools', project_id: 'p' }];
    const metrics = [
      { campaign_id: 'stones', date: '2026-10-01', spend: 100, impressions: 10, clicks: 2, reach: 10 },
      { campaign_id: 'tools', date: '2026-10-01', spend: 900, impressions: 90, clicks: 18, reach: 90 },
    ];
    const conversions = [
      { campaign_id: 'stones', date: '2026-10-01', action_type: 'yandex_goal:42:LC', count: 2, value: 0, is_measured: true },
      { campaign_id: 'tools', date: '2026-10-01', action_type: 'yandex_goal:42:LC', count: 30, value: 0, is_measured: true },
    ];
    const direction: AdDirection = { id: 'd', project_id: 'p', name: 'Камни', counter_ids: ['123'], websites: [], campaign_ids: ['stones'], primary_goal: 'yandex:42', is_active: true };
    const cards = buildGoalCards({ selected: directionCampaigns(direction, campaigns), goals: new Map(), settings: [], metrics, conversions, previousMetrics: [], previousConversions: [], yandexGoals: [{ id: '42', name: 'Покупка', domain: '', counterId: '123', campaignIds: ['stones', 'tools'] }] });
    expect(cards[0].current).toEqual({ results: 2, spend: 100, cpa: 50, complete: true });
    const url = new URL(directionReportHref(direction), 'https://example.com');
    expect(Object.fromEntries(url.searchParams)).toEqual({ project: 'p', direction: 'd', section: 'ads' });
  });
});

describe('chooseYandexSyncGoals', () => {
  const goal = (id: string) => ({ id, name: `Цель ${id}`, domain: 'site.ru', counterId: null });
  it('loads the whole small catalog except goals the owner hid', () => {
    const chosen = chooseYandexSyncGoals({ catalog: ['1', '2', '3'].map(goal), settings: [{ goal_key: 'yandex:2', hidden: true }], recentGoalIds: new Set() });
    expect(chosen.map((g) => g.id)).toEqual(['1', '3']);
  });
  it('limits a huge catalog to configured, direction and recently converting goals', () => {
    const catalog = Array.from({ length: 800 }, (_, index) => goal(String(index + 1)));
    const chosen = chooseYandexSyncGoals({
      catalog,
      settings: [{ goal_key: 'yandex:5', hidden: false }, { goal_key: 'yandex:6', hidden: true, is_primary: true }, { goal_key: 'yandex:7', hidden: true }],
      requiredKeys: ['yandex:700', null],
      recentGoalIds: new Set(['7', '100', '200']),
    });
    expect(chosen.map((g) => g.id).sort()).toEqual(['100', '200', '5', '6', '700']);
  });
  it('never exceeds the limit with recent goals', () => {
    const catalog = Array.from({ length: 200 }, (_, index) => goal(String(index + 1)));
    const chosen = chooseYandexSyncGoals({ catalog, settings: [], recentGoalIds: new Set(catalog.map((g) => g.id)), limit: 20 });
    expect(chosen).toHaveLength(20);
  });
});
