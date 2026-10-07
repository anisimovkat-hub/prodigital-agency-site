import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchYandexCampaignReport, fetchYandexClient, fetchYandexGoalReport, fetchYandexGoals, fetchYandexCampaignInfo, parseYandexCampaignReport, readYandexGoalCounters } from "@/lib/yandex-direct";

import { buildGoalCards } from "@/lib/project-ad-goals";

const fetchMock = vi.fn();

function response(data: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => data,
  } as Response;
}

describe("fetchYandexClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("reads the client by login with the account token", async () => {
    fetchMock.mockResolvedValue(response({ result: { Clients: [{ Login: "client-a", ClientInfo: "Клиент", Currency: "RUB", Archived: "NO" }] } }));
    await expect(fetchYandexClient({ token: "t", clientLogin: "client-a" })).resolves.toEqual({ login: "client-a", name: "Клиент", currency: "RUB", archived: false });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.direct.yandex.com/json/v5/clients");
    expect(init.headers).toMatchObject({ Authorization: "Bearer t", "Client-Login": "client-a" });
  });

  it("explains a missing representative access", async () => {
    fetchMock.mockResolvedValue(response({ error: { error_code: 53, error_string: "Нет доступа" } }, false));
    await expect(fetchYandexClient({ token: "t", clientLogin: "x" })).rejects.toThrow("Яндекс.Директ: Нет доступа");
  });
});

describe("parseYandexCampaignReport", () => {
  it('uses the exact LC goal column, never the aggregate', () => {
    const tsv = 'Date\tCampaignId\tCampaignName\tImpressions\tClicks\tCost\tConversions\tConversions_42_LC\tConversions_43_LC\n2026-10-01\t101\tПоиск\t100\t4\t200\t739\t2\t0\n2026-10-02\t101\tПоиск\t100\t4\t200\t90\t--\t--';
    const rows = parseYandexCampaignReport(tsv, ['42','43']);
    expect(rows[0].goals).toEqual({ '42': 2, '43': 0 });
    expect(rows[1].goals).toEqual({ '42': 0, '43': 0 });
  });
  it('keeps empty and truncated goal cells unknown, not zero', () => {
    const tsv = 'Date\tCampaignId\tCampaignName\tImpressions\tClicks\tCost\tConversions_42_LC\tConversions_43_LC\n2026-10-01\t101\tПоиск\t100\t4\t200\t\n2026-10-02\t101\tПоиск\t100\t4\t200\t--';
    const rows = parseYandexCampaignReport(tsv, ['42', '43']);
    expect(rows[0].goals).toEqual({ '42': null, '43': null });
    expect(rows[1].goals).toEqual({ '42': 0, '43': null });
  });
  it('keeps a period complete across zero-conversion days without combining its goals', () => {
    const tsv = 'Date\tCampaignId\tCampaignName\tImpressions\tClicks\tCost\tConversions_42_LC\tConversions_43_LC\n2026-10-01\t101\tПоиск\t100\t4\t200\t2\t1\n2026-10-02\t101\tПоиск\t100\t4\t200\t--\t--';
    const rows = parseYandexCampaignReport(tsv, ['42', '43']);
    const metrics = rows.map((row) => ({ campaign_id: row.campaignId, date: row.date, spend: row.cost, impressions: row.impressions, clicks: row.clicks }));
    const conversions = rows.flatMap((row) => Object.entries(row.goals!).map(([id, count]) => ({ campaign_id: row.campaignId, date: row.date, action_type: `yandex_goal:${id}:LC`, count: count ?? 0, is_measured: count !== null })));
    const cards = buildGoalCards({ selected: new Set(['101']), goals: new Map(), settings: [], metrics, conversions, previousMetrics: [], previousConversions: [], yandexGoals: ['42', '43'].map((id) => ({ id, name: id, domain: 'example.test', counterId: '123', campaignIds: ['101'] })) });
    expect(cards.map((card) => card.current)).toEqual([
      { results: 2, spend: 400, cpa: 200, complete: true },
      { results: 1, spend: 400, cpa: 400, complete: true },
    ]);
    expect(cards.every((card) => card.previous.complete === false)).toBe(true);
  });
  it('rejects a missing requested goal column and invalid metric values', () => {
    const tsv = 'Date\tCampaignId\tCampaignName\tImpressions\tClicks\tCost\n2026-10-01\t101\tПоиск\t100\t4\t200';
    expect(() => parseYandexCampaignReport(tsv, ['42'])).toThrow('не вернул запрошенную цель');
    expect(() => parseYandexCampaignReport(tsv.replace('200', 'NaN'))).toThrow('некорректное число');
  });
  it("reads daily rows and keeps unmeasured conversions as null", () => {
    const tsv = "Date\tCampaignId\tCampaignName\tImpressions\tClicks\tCost\tConversions\n2026-10-01\t101\tПоиск\t1200\t40\t1530.5\t3\n2026-10-02\t101\tПоиск\t900\t31\t1201\t--\n";
    expect(parseYandexCampaignReport(tsv)).toEqual([
      { date: "2026-10-01", campaignId: "101", campaignName: "Поиск", impressions: 1200, clicks: 40, cost: 1530.5, conversions: 3 },
      { date: "2026-10-02", campaignId: "101", campaignName: "Поиск", impressions: 900, clicks: 31, cost: 1201, conversions: null },
    ]);
  });

  it("keeps spend when the report has no Conversions column", () => {
    const tsv = "Date\tCampaignId\tCampaignName\tImpressions\tClicks\tCost\n2026-10-01\t5\tРСЯ\t10\t1\t20\n";
    expect(parseYandexCampaignReport(tsv)[0]).toMatchObject({ cost: 20, conversions: null });
  });

  it("returns no rows for an empty report", () => {
    expect(parseYandexCampaignReport("")).toEqual([]);
  });
});

describe("fetchYandexCampaignReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("waits for an offline report and sends Client-Login without VAT", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce({ status: 201, headers: new Headers({ retryIn: "1" }) } as Response)
      .mockResolvedValueOnce({ status: 200, text: async () => "Date\tCampaignId\tCampaignName\tImpressions\tClicks\tCost\tConversions\n" } as Response);
    const pending = fetchYandexCampaignReport({ token: "t", clientLogin: "client-a" }, "2026-10-01", "2026-10-07");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual([]);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Client-Login"]).toBe("client-a");
    expect(JSON.parse(init.body).params.IncludeVAT).toBe("NO");
    vi.useRealTimers();
  });
});

describe('Yandex goal discovery and goal reports', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock); });
  it('discovers real goals, excluding audience segments and unrelated client goals', async () => {
    fetchMock.mockResolvedValue(response({ data: [
      { GoalID: 42, Name: 'Спасибо', GoalDomain: 'site.ru', Type: 'goal', Login: 'client' },
      { GoalID: 43, Name: 'Аудитория', Type: 'segment', Login: 'client' },
      { GoalID: 44, Name: 'Чужая цель', Type: 'goal', Login: 'other' },
    ] }));
    expect(await fetchYandexGoals({ token: 't', clientLogin: 'client' })).toEqual([{ id: '42', name: 'Спасибо', domain: 'site.ru', counterId: null }]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).param).toEqual({ Logins: ['client'] });
  });
  it('reads real counter IDs from campaign types, including paginated results', async () => {
    fetchMock.mockResolvedValueOnce(response({ result: { Campaigns: [{ Id: 1, Name: 'Поиск', State: 'ON', TextCampaign: { CounterIds: { Items: [123] } } }], LimitedBy: 1 } }))
      .mockResolvedValueOnce(response({ result: { Campaigns: [{ Id: 2, Name: 'ЕПК', State: 'SUSPENDED', UnifiedCampaign: { CounterIds: { Items: [456] } } }] } }));
    expect(await fetchYandexCampaignInfo({ token: 't' })).toEqual([{ id: '1', name: 'Поиск', status: 'ON', counterIds: ['123'] }, { id: '2', name: 'ЕПК', status: 'SUSPENDED', counterIds: ['456'] }]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).params.Page.Offset).toBe(1);
  });
  it('does not require broader Metrika access or infer a counter when permissions are absent', async () => {
    fetchMock.mockResolvedValue(response({ errors: [] }, false));
    expect(await readYandexGoalCounters({ token: 't' }, ['123'])).toEqual(new Map());
  });
  it('merges eleven goals in batches of ten without doubling spend', async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      const goals = JSON.parse(init.body).params.Goals as string[];
      return { status: 200, text: async () => `Date\tCampaignId\tCampaignName\tImpressions\tClicks\tCost\t${goals.map((id) => `Conversions_${id}_LC`).join('\t')}\n2026-10-01\t101\tПоиск\t100\t4\t200\t${goals.map(() => '1').join('\t')}` } as Response;
    });
    const goals = Array.from({ length: 11 }, (_, i) => ({ id: String(i+1), name: 'Цель', domain: 'site.ru', counterId: null }));
    const result = await fetchYandexGoalReport({ token: 't' }, '2026-10-01', '2026-10-01', goals);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ cost: 200, conversions: null });
    expect(Object.keys(result[0].goals!)).toHaveLength(11);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).params.AttributionModels).toEqual(['LC']);
  });
  it('keeps one spend snapshot when the unfinished current day changes between goal batches', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-07T10:00:00Z'));
    let calls = 0;
    fetchMock.mockImplementation(async (_url, init) => {
      const ids = JSON.parse(init.body).params.Goals as string[];
      return { status: 200, text: async () => `Date\tCampaignId\tCampaignName\tImpressions\tClicks\tCost\t${ids.map((id) => `Conversions_${id}_LC`).join('\t')}\n2026-10-07\t101\tПоиск\t${100 + calls++}\t4\t200\t${ids.map(() => '1').join('\t')}` } as Response;
    });
    try {
      const rows = await fetchYandexGoalReport({ token: 't' }, '2026-10-07', '2026-10-07', Array.from({length:11},(_,i)=>({id:String(i+1),name:'Цель',domain:'',counterId:null})));
      expect(rows[0]).toMatchObject({ impressions: 100, cost: 200 });
      expect(Object.keys(rows[0].goals!)).toHaveLength(11);
    } finally { vi.useRealTimers(); }
  });
});
