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
export type MetaCampaign = {
  externalId: string;
  name: string | null;
  objective: string | null;
  status: string | null;
};
export type MetaCustomConversion = {
  conversionId: string;
  name: string | null;
};
// Конверсия по конкретной цели: action_type сохраняем как есть, без схлопывания.
export type MetaConversion = {
  actionType: string;
  count: number;
  value: number;
};
export type MetaCampaignDailyMetric = {
  campaignExternalId: string;
  campaignName: string | null;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: MetaConversion[];
};

type MetaAction = { action_type?: string; value?: string };
type MetaAccountRow = { account_id?: string; name?: string; currency?: string };
type MetaCampaignRow = {
  id?: string;
  name?: string;
  objective?: string;
  status?: string;
};
type MetaCustomConversionRow = { id?: string; name?: string };
type MetaInsightRow = {
  date_start?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: MetaAction[];
};
type MetaCampaignInsightRow = MetaInsightRow & {
  campaign_id?: string;
  campaign_name?: string;
  reach?: string;
  action_values?: MetaAction[];
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

// Постраничный обход списочного эндпоинта Graph API (paging.next).
async function fetchAllPages<T>(firstUrl: string): Promise<T[]> {
  let url: string | null = firstUrl;
  const out: T[] = [];
  let guard = 0;
  while (url && guard < 50) {
    guard += 1;
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as MetaListResponse<T>;
    if (!res.ok) throw new Error(metaError(json, res.status));
    out.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }
  return out;
}

// Справочник кастомных конверсий кабинета: id → человекочитаемое имя.
// В insights приходит только action_type offsite_conversion.custom.<id>.
export async function fetchMetaCustomConversions(
  externalId: string,
): Promise<MetaCustomConversion[]> {
  const params = new URLSearchParams({
    fields: "id,name",
    limit: "500",
    access_token: token(),
  });
  const rows = await fetchAllPages<MetaCustomConversionRow>(
    `${BASE}/${externalId}/customconversions?${params.toString()}`,
  );
  return rows
    .filter((row) => row.id)
    .map((row) => ({
      conversionId: String(row.id),
      name: row.name ?? null,
    }));
}

// Кампании кабинета: нужны имя, цель и статус (в insights их нет).
export async function fetchMetaCampaigns(
  externalId: string,
): Promise<MetaCampaign[]> {
  const params = new URLSearchParams({
    fields: "id,name,objective,status",
    limit: "500",
    access_token: token(),
  });
  const rows = await fetchAllPages<MetaCampaignRow>(
    `${BASE}/${externalId}/campaigns?${params.toString()}`,
  );
  return rows
    .filter((row) => row.id)
    .map((row) => ({
      externalId: String(row.id),
      name: row.name ?? null,
      objective: row.objective ?? null,
      status: row.status ?? null,
    }));
}

// Суточные метрики кампаний за период. Все action_type из actions отдаются как есть:
// у разных кампаний разные цели (лид, сообщение, покупка, свой пиксель).
export async function fetchMetaCampaignInsights(
  externalId: string,
  since: string,
  until: string,
): Promise<MetaCampaignDailyMetric[]> {
  const params = new URLSearchParams({
    fields:
      "campaign_id,campaign_name,spend,impressions,clicks,reach,actions,action_values",
    level: "campaign",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    limit: "500",
    access_token: token(),
  });
  const rows = await fetchAllPages<MetaCampaignInsightRow>(
    `${BASE}/${externalId}/insights?${params.toString()}`,
  );
  const out: MetaCampaignDailyMetric[] = [];
  for (const row of rows) {
    if (!row.campaign_id || !row.date_start) continue;
    out.push({
      campaignExternalId: row.campaign_id,
      campaignName: row.campaign_name ?? null,
      date: row.date_start,
      spend: Number(row.spend ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      reach: Number(row.reach ?? 0),
      conversions: toConversions(row.actions, row.action_values),
    });
  }
  return out;
}

// actions = количество конверсий, action_values = их денежная ценность (может не быть).
function toConversions(
  actions: MetaAction[] | undefined,
  actionValues: MetaAction[] | undefined,
): MetaConversion[] {
  if (!Array.isArray(actions)) return [];
  const values = new Map<string, number>();
  for (const item of actionValues ?? []) {
    if (item.action_type) values.set(item.action_type, Number(item.value ?? 0));
  }
  const out: MetaConversion[] = [];
  for (const action of actions) {
    if (!action.action_type) continue;
    const count = Number(action.value ?? 0);
    if (!Number.isFinite(count)) continue;
    out.push({
      actionType: action.action_type,
      count,
      value: values.get(action.action_type) ?? 0,
    });
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
