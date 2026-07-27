import "server-only";

// Клиент Meta Graph API. Токен берётся ТОЛЬКО из sensitive env META_ACCESS_TOKEN
// (в Git/БД его нет). Версию API при необходимости бумпнуть здесь.
const API_VERSION = "v23.0";
const BASE = `https://graph.facebook.com/${API_VERSION}`;

export type MetaAccount = {
  externalId: string;
  name: string | null;
  currency: string | null;
};
export type MetaDailyMetric = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
};

type MetaAction = { action_type?: string; value?: string };
type MetaAccountRow = { account_id?: string; name?: string; currency?: string };
type MetaInsightRow = {
  date_start?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: MetaAction[];
};
type MetaListResponse<T> = {
  data?: T[];
  paging?: { next?: string };
  error?: { message?: string };
};

// Типы конверсий Meta, которые считаем «лидами».
const LEAD_ACTION_TYPES = new Set([
  "lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead_grouped",
  "leadgen.other",
  "onsite_conversion.messaging_conversation_started_7d",
]);

function token(): string {
  const value = process.env.META_ACCESS_TOKEN;
  if (!value) {
    throw new Error(
      "META_ACCESS_TOKEN не задан в переменных окружения Vercel — добавьте токен и повторите.",
    );
  }
  return value;
}

function metaError(json: MetaListResponse<unknown>, status: number): string {
  return json?.error?.message
    ? `Meta API: ${json.error.message}`
    : `Meta API вернул статус ${status}`;
}

// Все рекламные кабинеты, доступные системному пользователю токена.
export async function fetchMetaAccounts(): Promise<MetaAccount[]> {
  const url = `${BASE}/me/adaccounts?fields=account_id,name,currency&limit=500&access_token=${encodeURIComponent(token())}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as MetaListResponse<MetaAccountRow>;
  if (!res.ok) throw new Error(metaError(json, res.status));
  return (json.data ?? [])
    .filter((row) => row.account_id)
    .map((row) => ({
      externalId: `act_${row.account_id}`,
      name: row.name ?? null,
      currency: row.currency ?? null,
    }));
}

// Суточные метрики каб. за период [since, until] (YYYY-MM-DD).
export async function fetchMetaInsights(
  externalId: string,
  since: string,
  until: string,
): Promise<MetaDailyMetric[]> {
  const params = new URLSearchParams({
    fields: "spend,impressions,clicks,actions",
    level: "account",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    limit: "500",
    access_token: token(),
  });
  let url: string | null = `${BASE}/${externalId}/insights?${params.toString()}`;
  const out: MetaDailyMetric[] = [];
  let guard = 0;
  while (url && guard < 20) {
    guard += 1;
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as MetaListResponse<MetaInsightRow>;
    if (!res.ok) throw new Error(metaError(json, res.status));
    for (const row of json.data ?? []) {
      if (!row.date_start) continue;
      out.push({
        date: row.date_start,
        spend: Number(row.spend ?? 0),
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        leads: sumLeads(row.actions),
      });
    }
    url = json.paging?.next ?? null;
  }
  return out;
}

function sumLeads(actions: MetaAction[] | undefined): number {
  if (!Array.isArray(actions)) return 0;
  return actions.reduce(
    (sum, action) =>
      action.action_type && LEAD_ACTION_TYPES.has(action.action_type)
        ? sum + Number(action.value ?? 0)
        : sum,
    0,
  );
}
