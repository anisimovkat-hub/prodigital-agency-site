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
  error?: { error_code?: number; error_string?: string; error_detail?: string };
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
    ? `Яндекс.Директ: ${json.error.error_string}${json.error.error_detail ? ` — ${json.error.error_detail}` : ""}`
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

const API = "https://api.direct.yandex.com/json/v5";

export type YandexClient = { login: string; name: string | null; currency: string | null; archived: boolean };

function headers(clientLogin?: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token()}`,
    "Accept-Language": "ru",
    "Content-Type": "application/json",
    ...(clientLogin ? { "Client-Login": clientLogin } : {}),
  };
}

/**
 * Clients.get: without Client-Login it describes the token owner; with it, a client
 * the token owner may read as an agency or as that advertiser's representative.
 */
export async function fetchYandexClient(clientLogin?: string): Promise<YandexClient> {
  const response = await fetch(`${API}/clients`, {
    method: "POST",
    cache: "no-store",
    headers: headers(clientLogin),
    body: JSON.stringify({ method: "get", params: { FieldNames: ["Login", "ClientInfo", "Currency", "Archived"] } }),
  });
  const json = (await response.json()) as { result?: { Clients?: AgencyClientRow[] }; error?: YandexDirectResponse["error"] };
  if (!response.ok || json.error) throw new Error(errorMessage(json, response.status));
  const client = json.result?.Clients?.[0];
  if (!client?.Login) throw new Error("Яндекс.Директ не вернул данные кабинета.");
  return {
    login: client.Login,
    name: client.ClientInfo ?? null,
    currency: client.Currency ?? null,
    archived: client.Archived === true || client.Archived === "YES",
  };
}

export type YandexCampaignDay = {
  date: string;
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number | null;
};

const REPORT_FIELDS = ["Date", "CampaignId", "CampaignName", "Impressions", "Clicks", "Cost", "Conversions"] as const;

/** Parses a Reports TSV without header/summary rows; "--" means "not measured". */
export function parseYandexCampaignReport(tsv: string): YandexCampaignDay[] {
  const lines = tsv.split("\n").map((line) => line.replace(/\r$/, "")).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split("\t");
  const at = (name: (typeof REPORT_FIELDS)[number]) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`В отчёте Яндекс.Директа нет столбца ${name}.`);
    return index;
  };
  const columns = Object.fromEntries(REPORT_FIELDS.map((name) => [name, at(name)])) as Record<(typeof REPORT_FIELDS)[number], number>;
  const number = (value: string | undefined) => (value === undefined || value === "--" || value === "" ? 0 : Number(value));
  return lines.slice(1).map((line) => {
    const cells = line.split("\t");
    const conversions = cells[columns.Conversions];
    return {
      date: cells[columns.Date],
      campaignId: cells[columns.CampaignId],
      campaignName: cells[columns.CampaignName],
      impressions: number(cells[columns.Impressions]),
      clicks: number(cells[columns.Clicks]),
      cost: number(cells[columns.Cost]),
      conversions: conversions === undefined || conversions === "--" ? null : Number(conversions),
    };
  });
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Daily campaign statistics through the Reports service, cost without VAT.
 * Offline reports answer 201/202 first; we poll with the delay Yandex suggests.
 */
export async function fetchYandexCampaignReport(
  clientLogin: string,
  from: string,
  to: string,
  { maxAttempts = 12 }: { maxAttempts?: number } = {},
): Promise<YandexCampaignDay[]> {
  const body = JSON.stringify({
    params: {
      SelectionCriteria: { DateFrom: from, DateTo: to },
      FieldNames: REPORT_FIELDS,
      ReportName: `agency-os ${clientLogin} ${from} ${to}`,
      ReportType: "CUSTOM_REPORT",
      DateRangeType: "CUSTOM_DATE",
      Format: "TSV",
      IncludeVAT: "NO",
    },
  });
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(`${API}/reports`, {
      method: "POST",
      cache: "no-store",
      headers: {
        ...headers(clientLogin),
        processingMode: "auto",
        returnMoneyInMicros: "false",
        skipReportHeader: "true",
        skipReportSummary: "true",
      },
      body,
    });
    if (response.status === 200) return parseYandexCampaignReport(await response.text());
    if (response.status === 201 || response.status === 202) {
      const retryIn = Number(response.headers.get("retryIn") ?? "5");
      await sleep(Math.min(30, Math.max(1, Number.isFinite(retryIn) ? retryIn : 5)) * 1000);
      continue;
    }
    let message = `Яндекс.Директ вернул статус ${response.status}.`;
    try {
      const json = (await response.json()) as YandexDirectResponse;
      message = errorMessage(json, response.status);
    } catch { /* non-JSON error body */ }
    throw new Error(`${clientLogin}: ${message}`);
  }
  throw new Error(`${clientLogin}: отчёт Яндекс.Директа не успел сформироваться, повторите позже.`);
}
