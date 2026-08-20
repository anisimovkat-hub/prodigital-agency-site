import "server-only";

const BASE_URL = "https://api.direct.yandex.com/json/v5/agencyclients";

export type YandexAgencyClient = {
  login: string;
  clientId: string | null;
  name: string | null;
  currency: string | null;
  archived: boolean;
};

type AgencyClientRow = {
  Login?: string;
  ClientId?: string | number;
  ClientInfo?: string;
  Currency?: string;
  Archived?: "YES" | "NO" | boolean;
};

type YandexDirectResponse = {
  result?: { Clients?: AgencyClientRow[] };
  error?: { error_code?: number; error_string?: string };
};

function token(): string {
  const value = process.env.YANDEX_DIRECT_TOKEN;
  if (!value) {
    throw new Error(
      "YANDEX_DIRECT_TOKEN не задан в sensitive-переменных Vercel.",
    );
  }
  return value;
}

function errorMessage(json: YandexDirectResponse, status: number): string {
  return json.error?.error_string
    ? `Яндекс.Директ: ${json.error.error_string}`
    : `Яндекс.Директ вернул статус ${status}.`;
}

// Первый и единственный запрос этапа Y1. Не передаём Client-Login: метод
// возвращает весь список рекламодателей, доступных агентскому представителю.
export async function fetchYandexAgencyClients(): Promise<YandexAgencyClient[]> {
  const response = await fetch(BASE_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Accept-Language": "ru",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      method: "get",
      params: {
        SelectionCriteria: {},
        FieldNames: ["Login", "ClientId", "ClientInfo", "Currency", "Archived"],
      },
    }),
  });
  const json = (await response.json()) as YandexDirectResponse;
  if (!response.ok || json.error) throw new Error(errorMessage(json, response.status));

  return (json.result?.Clients ?? [])
    .filter((client): client is AgencyClientRow & { Login: string } => Boolean(client.Login))
    .map((client) => ({
      login: client.Login,
      clientId: client.ClientId === undefined ? null : String(client.ClientId),
      name: client.ClientInfo ?? null,
      currency: client.Currency ?? null,
      archived: client.Archived === true || client.Archived === "YES",
    }))
    .sort((a, b) => a.login.localeCompare(b.login, "ru"));
}
