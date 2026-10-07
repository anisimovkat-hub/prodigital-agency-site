import { describe, expect, it } from 'vitest';
import { directionCampaigns, parseYandexGoals, yandexGoalLabel, type AdDirection } from './yandex-goals';

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
});
