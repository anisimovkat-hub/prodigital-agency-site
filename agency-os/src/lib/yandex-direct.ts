import "server-only";
import type { YandexGoal } from "@/lib/yandex-goals";

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

function errorMessage(json: Pick<YandexDirectResponse, 'error'>, status: number): string {
  return json.error?.error_string
    ? `Яндекс.Директ: ${json.error.error_string}${json.error.error_detail ? ` — ${json.error.error_detail}` : ""}`
    : `Яндекс.Директ вернул статус ${status}.`;
}

const API = "https://api.direct.yandex.com/json/v5";

export type YandexClient = { login: string; name: string | null; currency: string | null; archived: boolean };

/** The OAuth token stored for a connected account, and the client login it reads. */
export type YandexAuth = { token: string; clientLogin?: string };

function headers(auth: YandexAuth): Record<string, string> {
  const { clientLogin } = auth;
  return {
    Authorization: `Bearer ${auth.token}`,
    "Accept-Language": "ru",
    "Content-Type": "application/json",
    ...(clientLogin ? { "Client-Login": clientLogin } : {}),
  };
}

/**
 * Clients.get: without Client-Login it describes the token owner; with it, a client
 * the token owner may read as an agency or as that advertiser's representative.
 */
export async function fetchYandexClient(auth: YandexAuth): Promise<YandexClient> {
  const response = await fetch(`${API}/clients`, {
    method: "POST",
    cache: "no-store",
    headers: headers(auth),
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
  goals?: Record<string, number | null>;
};

const REPORT_FIELDS = ["Date", "CampaignId", "CampaignName", "Impressions", "Clicks", "Cost", "Conversions"] as const;

/** Parses a Reports TSV. Missing cells are unknown; an explicit goal count "--" is zero. */
export function parseYandexCampaignReport(tsv: string, goalIds: string[] = []): YandexCampaignDay[] {
  const lines = tsv.split("\n").map((line) => line.replace(/\r$/, "")).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split("\t");
  const at = (name: (typeof REPORT_FIELDS)[number]) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`В отчёте Яндекс.Директа нет столбца ${name}.`);
    return index;
  };
  // Accounts without key goals may come back without a Conversions column: spend still counts.
  const columns = Object.fromEntries(REPORT_FIELDS.map((name) => [name, name === "Conversions" ? header.indexOf(name) : at(name)])) as Record<(typeof REPORT_FIELDS)[number], number>;
  const number = (value: string | undefined) => {
    if (value === undefined || value === "--" || value === "") return 0;
    const result = Number(value);
    if (!Number.isFinite(result) || result < 0) throw new Error("Яндекс вернул некорректное число в отчёте.");
    return result;
  };
  const goalColumns = goalIds.map((id) => {
    const index = header.indexOf(`Conversions_${id}_LC`);
    if (index < 0) throw new Error(`Яндекс не вернул запрошенную цель ${id}. Данные не заменены нулями.`);
    return { id, index };
  });
  return lines.slice(1).map((line) => {
    const cells = line.split("\t");
    const conversions = columns.Conversions < 0 ? undefined : cells[columns.Conversions];
    return {
      date: cells[columns.Date],
      campaignId: cells[columns.CampaignId],
      campaignName: cells[columns.CampaignName],
      impressions: number(cells[columns.Impressions]),
      clicks: number(cells[columns.Clicks]),
      cost: number(cells[columns.Cost]),
      conversions: conversions === undefined || conversions === "--" || conversions === "" ? null : number(conversions),
      // A successful explicit Conversions_<goal>_LC column uses "--" for no
      // conversions. Missing columns/cells and failed imports remain unknown.
      ...(goalIds.length ? { goals: Object.fromEntries(goalColumns.map(({ id, index }) => [id, cells[index] === undefined || cells[index] === "" ? null : number(cells[index])])) } : {}),
    };
  });
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Daily campaign statistics through the Reports service, cost without VAT.
 * Offline reports answer 201/202 first; we poll with the delay Yandex suggests.
 */
export async function fetchYandexCampaignReport(
  auth: YandexAuth,
  from: string,
  to: string,
  { maxAttempts = 12, goalIds = [] }: { maxAttempts?: number; goalIds?: string[] } = {},
): Promise<YandexCampaignDay[]> {
  if (goalIds.length > 10 || goalIds.some((id) => !/^\d+$/.test(id))) throw new Error("За запрос можно получить не более 10 целей Яндекса.");
  const body = JSON.stringify({
    params: {
      SelectionCriteria: { DateFrom: from, DateTo: to },
      FieldNames: REPORT_FIELDS,
      ...(goalIds.length ? { Goals: goalIds, AttributionModels: ["LC"] } : {}),
      // Yandex caches reports by name; a fresh name returns today's numbers, not a cached copy.
      ReportName: `agency-os ${auth.clientLogin ?? "self"} ${from} ${to} ${goalIds.join('-')} ${Date.now()}`,
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
        ...headers(auth),
        processingMode: "auto",
        returnMoneyInMicros: "false",
        skipReportHeader: "true",
        skipReportSummary: "true",
      },
      body,
    });
    if (response.status === 200) return parseYandexCampaignReport(await response.text(), goalIds);
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
    throw new Error(message);
  }
  throw new Error("Отчёт Яндекс.Директа не успел сформироваться, повторите позже.");
}

/** Read-only Live 4 catalog. Segments are not conversion goals. Token never leaves the server. */
export async function fetchYandexGoals(auth: YandexAuth): Promise<YandexGoal[]> {
  const response = await fetch("https://api.direct.yandex.ru/live/v4/json/", {
    method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: "GetRetargetingGoals", token: auth.token, locale: "ru", param: auth.clientLogin ? { Logins: [auth.clientLogin] } : {} }),
  });
  const json = await response.json() as { data?: { GoalID: number; Name: string; GoalDomain: string; Type: string; Login?: string }[]; error_str?: string };
  if (!response.ok || json.error_str || !Array.isArray(json.data)) throw new Error("Не удалось получить список целей Яндекса. Проверьте доступ к счётчикам.");
  return [...new Map(json.data.filter((row) => row.Type === "goal" && Number.isSafeInteger(row.GoalID) && row.GoalID > 0 && (!auth.clientLogin || !row.Login || row.Login.toLowerCase() === auth.clientLogin.toLowerCase()))
    .map((row) => [String(row.GoalID), { id: String(row.GoalID), name: row.Name, domain: row.GoalDomain ?? "", counterId: null }])).values()];
}

/** Read existing Metrika permissions only. A Direct-only token simply leaves the counter unknown. */
export async function readYandexGoalCounters(auth: YandexAuth, counterIds: string[]): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  for (const counterId of [...new Set(counterIds)].filter((id) => /^[1-9]\d*$/.test(id))) {
    const response = await fetch(`https://api-metrika.yandex.net/management/v1/counter/${counterId}/goals`, {
      cache: 'no-store', headers: { Authorization: `OAuth ${auth.token}` }, signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!response?.ok) continue;
    const json = await response.json().catch(() => null) as { goals?: { id: number }[] } | null;
    for (const goal of json?.goals ?? []) if (Number.isSafeInteger(goal.id) && goal.id > 0) mapping.set(String(goal.id), counterId);
  }
  return mapping;
}

type CounterContainer = { CounterIds?: { Items?: number[] } };
export type YandexCampaignInfo = { id: string; name: string; status: string; counterIds: string[] };
/** Campaign counters are hints for setup, not proof that a campaign advertises only one product. */
export async function fetchYandexCampaignInfo(auth: YandexAuth): Promise<YandexCampaignInfo[]> {
  const campaigns: YandexCampaignInfo[] = [];
  let offset = 0;
  for (let page = 0; page < 100; page++) {
    const response = await fetch(`${API}/campaigns`, { method: "POST", cache: "no-store", headers: headers(auth), body: JSON.stringify({ method: "get", params: {
      SelectionCriteria: {}, FieldNames: ["Id", "Name", "State"], TextCampaignFieldNames: ["CounterIds"], UnifiedCampaignFieldNames: ["CounterIds"], CpmBannerCampaignFieldNames: ["CounterIds"], Page: { Limit: 1000, Offset: offset },
    } }) });
    const json = await response.json() as { error?: YandexDirectResponse['error']; result?: { Campaigns?: { Id: number; Name: string; State: string; TextCampaign?: CounterContainer; UnifiedCampaign?: CounterContainer; CpmBannerCampaign?: CounterContainer }[]; LimitedBy?: number } };
    if (!response.ok || json.error) throw new Error(errorMessage(json, response.status));
    campaigns.push(...(json.result?.Campaigns ?? []).map((row) => ({ id: String(row.Id), name: row.Name, status: row.State,
      counterIds: [...new Set([row.TextCampaign, row.UnifiedCampaign, row.CpmBannerCampaign].flatMap((item) => item?.CounterIds?.Items ?? []).map(String))] })));
    if (!json.result?.LimitedBy) return campaigns;
    offset = json.result.LimitedBy;
  }
  throw new Error("Слишком много страниц кампаний Яндекса.");
}

/** Merge goal batches into one campaign/day: money and clicks must never be duplicated. */
export async function fetchYandexGoalReport(auth: YandexAuth, from: string, to: string, goals: YandexGoal[]): Promise<YandexCampaignDay[]> {
  const ids = [...new Set(goals.map((goal) => goal.id))];
  if (!ids.length) {
    const rows = await fetchYandexCampaignReport(auth, from, to);
    return rows.map((row) => ({ ...row, conversions: null, goals: {} }));
  }
  const days = new Map<string, YandexCampaignDay>();
  for (let index = 0; index < ids.length; index += 10) {
    const batch = ids.slice(index, index + 10);
    const rows = await fetchYandexCampaignReport(auth, from, to, { goalIds: batch });
    for (const row of rows) {
      const key = `${row.campaignId}:${row.date}`;
      const previous = days.get(key);
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });
      if (previous && row.date !== today && (previous.cost !== row.cost || previous.clicks !== row.clicks || previous.impressions !== row.impressions)) throw new Error(`Метрики за ${row.date} изменились между пакетами целей. Повторите загрузку.`);
      // Today is an unfinished day. Keep ONE traffic/money snapshot; later goal batches
      // can see new events while the account is spending, but must not add its spend again.
      days.set(key, { ...(previous ?? row), conversions: null, goals: { ...previous?.goals, ...row.goals } });
    }
  }
  return [...days.values()];
}
