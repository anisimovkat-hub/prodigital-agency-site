import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), upsert: vi.fn(), from: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/connected-ads-sync', () => ({ fetchRequiredYandexReportDays: mocks.fetch, YANDEX_REPORT_BACKFILL_PERIOD: { from: '2026-10-16', to: '2026-10-29' } }));
import { backfillRequiredYandexReports } from './yandex-report-backfill';
const account = { id: 'approved', project_id: 'project' };
const requirement = { externalId: 'external', attribution: 'AUTO', goalIds: ['42'] };
const day = (campaignId = '101', action = 'yandex_goal:42:AUTO', count: number | null = 0) => ({ campaignId, date: '2026-10-23', goalResults: [{ action, count, value: count === null ? null : 0 }] });
const client = { from: mocks.from } as unknown as SupabaseClient<Database>;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockResolvedValue({ account, requirement, days: [day()] });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table: string) => {
    if (table === 'ad_conversions') return { upsert: mocks.upsert };
    const chain = { select: vi.fn(), eq: vi.fn() };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValueOnce(chain).mockResolvedValueOnce({ data: [{ id: 'internal', external_id: '101' }], error: null });
    return chain;
  });
});
describe('conversion-only required Yandex report recovery', () => {
  it('uses the idempotent conversion key and never writes metrics or campaigns', async () => {
    await backfillRequiredYandexReports(client, account.id);
    await backfillRequiredYandexReports(client, account.id);
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert.mock.calls[0]).toEqual(mocks.upsert.mock.calls[1]);
    expect(mocks.upsert.mock.calls[0][1]).toEqual({ onConflict: 'campaign_id,date,action_type' });
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(['ad_campaigns', 'ad_conversions', 'ad_campaigns', 'ad_conversions']);
  });
  it('stores unknown and measured zero separately and preserves signed values', async () => {
    const unknown = day('101', 'yandex_goal:42:LC', null);
    const measured = day(); measured.goalResults[0].value = -5;
    mocks.fetch.mockResolvedValue({ account, requirement, days: [unknown, measured] });
    const result = await backfillRequiredYandexReports(client, account.id);
    expect(mocks.upsert.mock.calls[0][0]).toEqual([
      { campaign_id: 'internal', date: '2026-10-23', action_type: 'yandex_goal:42:LC', count: 0, is_measured: false, value: 0, value_is_measured: false },
      { campaign_id: 'internal', date: '2026-10-23', action_type: 'yandex_goal:42:AUTO', count: 0, is_measured: true, value: -5, value_is_measured: true },
    ]);
    expect(result).toMatchObject({ measuredRows: 1, unknownRows: 1 });
  });
  it.each([
    ['unknown campaign', [day(), day('foreign')], 'REPORT_CAMPAIGN_OR_DATE_MISMATCH'],
    ['unexpected action', [day(), day('101', 'yandex_goal:99:AUTO')], 'REPORT_ACTION_MISMATCH'],
    ['duplicate key', [day(), day()], 'REPORT_ROW_BOUND_EXCEEDED'],
    ['empty recovery', [], 'REPORT_ROW_BOUND_EXCEEDED'],
  ])('validates all rows before writing: %s', async (_name, days, error) => {
    mocks.fetch.mockResolvedValue({ account, requirement, days });
    await expect(backfillRequiredYandexReports(client, account.id)).rejects.toThrow(error);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('never writes if upstream scope validation fails', async () => {
    mocks.fetch.mockRejectedValue(new Error('REPORT_PERIOD_MISMATCH'));
    await expect(backfillRequiredYandexReports(client, account.id)).rejects.toThrow('REPORT_PERIOD_MISMATCH');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each(['2026-10-15', '2026-10-30', '2026-10-230'])('rejects out-of-window or malformed date %s before writing', async (date) => {
    mocks.fetch.mockResolvedValue({ account, requirement, days: [{ ...day(), date }] });
    await expect(backfillRequiredYandexReports(client, account.id)).rejects.toThrow('REPORT_CAMPAIGN_OR_DATE_MISMATCH');
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('returns hashed source evidence without credential material', async () => {
    mocks.fetch.mockImplementation(async (_client, _id, hook) => {
      hook({ attribution: 'AUTO', goalIds: ['42'], tsv: 'raw report' });
      return { account, requirement, days: [day()] };
    });
    const result = await backfillRequiredYandexReports(client, account.id);
    expect(result.reports[0]).toMatchObject({ attribution: 'AUTO', goalIds: ['42'], tsv: 'raw report', sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
  });
});
