import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchYandexAgencyClients, fetchYandexCampaignReport, parseYandexCampaignReport } from "@/lib/yandex-direct";

const fetchMock = vi.fn();

function response(data: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => data,
  } as Response;
}

describe("fetchYandexAgencyClients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    process.env.YANDEX_DIRECT_TOKEN = "test-token";
  });

  it("вызывает AgencyClients.get без Client-Login и сохраняет архивный статус", async () => {
    fetchMock.mockResolvedValue(response({
      result: {
        Clients: [
          { Login: "active-login", ClientId: 42, ClientInfo: "Активный", Currency: "RUB", Archived: "NO" },
          { Login: "archive-login", ClientInfo: "Архив", Currency: "USD", Archived: "YES" },
        ],
      },
    }));

    await expect(fetchYandexAgencyClients()).resolves.toEqual([
      { login: "active-login", clientId: "42", name: "Активный", currency: "RUB", archived: false },
      { login: "archive-login", clientId: null, name: "Архив", currency: "USD", archived: true },
    ]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.direct.yandex.com/json/v5/agencyclients");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Accept-Language": "ru",
    });
    expect(init.body).toBe(JSON.stringify({
      method: "get",
      params: {
        SelectionCriteria: {},
        FieldNames: ["Login", "ClientId", "ClientInfo", "Currency", "Archived"],
      },
    }));
  });

  it("возвращает безопасную ошибку API", async () => {
    fetchMock.mockResolvedValue(response({ error: { error_string: "Нет доступа" } }, false));
    await expect(fetchYandexAgencyClients()).rejects.toThrow("Яндекс.Директ: Нет доступа");
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

  it("returns no rows for an empty report", () => {
    expect(parseYandexCampaignReport("")).toEqual([]);
  });
});

describe("fetchYandexCampaignReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    process.env.YANDEX_DIRECT_TOKEN = "test-token";
  });

  it("waits for an offline report and sends Client-Login without VAT", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce({ status: 201, headers: new Headers({ retryIn: "1" }) } as Response)
      .mockResolvedValueOnce({ status: 200, text: async () => "Date\tCampaignId\tCampaignName\tImpressions\tClicks\tCost\tConversions\n" } as Response);
    const pending = fetchYandexCampaignReport({ clientLogin: "client-a" }, "2026-10-01", "2026-10-07");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual([]);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Client-Login"]).toBe("client-a");
    expect(JSON.parse(init.body).params.IncludeVAT).toBe("NO");
    vi.useRealTimers();
  });
});
