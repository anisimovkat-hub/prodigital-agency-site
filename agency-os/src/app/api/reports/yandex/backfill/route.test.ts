import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), profile: vi.fn(), service: vi.fn(), backfill: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.auth }, from: () => { const chain = { select: () => chain, eq: () => chain, maybeSingle: mocks.profile }; return chain; } }) }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: mocks.service }));
vi.mock('@/lib/yandex-report-backfill', () => ({ backfillRequiredYandexReports: mocks.backfill }));
import { POST } from './route';
const id = '92d981b0-3e87-4345-8037-7de00077c988';
function request(body: unknown = { accountId: id }, origin: string | null = 'https://agency.test') {
  return new Request('https://agency.test/api/reports/yandex/backfill', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin === null ? {} : { origin }) }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  mocks.profile.mockResolvedValue({ data: { role: 'owner', is_active: true }, error: null });
  mocks.service.mockReturnValue({ marker: 'service' });
  mocks.backfill.mockResolvedValue({ conversionRows: 2, reports: [] });
});
describe('owner-only fixed Yandex recovery endpoint', () => {
  it.each([null, 'https://evil.test'])('rejects missing or foreign origin %s', async (origin) => {
    expect((await POST(request(undefined, origin))).status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.service).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated users', async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401); expect(mocks.service).not.toHaveBeenCalled();
  });
  it.each([{ role: 'admin', is_active: true }, { role: 'owner', is_active: false }, null])('rejects non-active owners: %j', async (profile) => {
    mocks.profile.mockResolvedValue({ data: profile, error: null });
    expect((await POST(request())).status).toBe(403); expect(mocks.service).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { accountId: 'foreign' }, { accountId: id, from: '2026-01-01' }, { accountId: id, projectId: 'foreign' }])('rejects expanded or invalid scope %j', async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: 'INVALID_RECOVERY_SCOPE' });
    expect(mocks.backfill).not.toHaveBeenCalled(); expect(mocks.service).not.toHaveBeenCalled();
  });
  it('sanitizes raw upstream failures', async () => {
    mocks.backfill.mockRejectedValue(new Error('Bearer sensitive-token; upstream body'));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'YANDEX_REPORT_RECOVERY_FAILED' });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it('allows the owner with only the approved account identifier', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.backfill).toHaveBeenCalledWith({ marker: 'service' }, id);
    expect(mocks.revalidate).toHaveBeenCalledWith('/analytics');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.json()).toEqual({ conversionRows: 2, reports: [] });
  });
});
