import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchYandexCampaignReport, fetchYandexClient, parseYandexCampaignReport } from "@/lib/yandex-direct";

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
