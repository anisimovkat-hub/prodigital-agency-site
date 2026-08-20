import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchYandexAgencyClients } from "@/lib/yandex-direct";

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
