import "server-only";

// This export deliberately cannot discover or select another client's account.
const ACCOUNT_ID = "1018564883119850";
const GRAPH_VERSION = "v23.0";
const BASE_FIELDS = "date_start,date_stop,account_id,account_currency,spend,impressions,inline_link_clicks,clicks";
const AD_FIELDS = `${BASE_FIELDS},campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,objective,actions`;
const MAX_PAGES = 80;

export type TeamTripPeriod = { since: string; until: string };
type RecordValue = Record<string, unknown>;
type Insight = Record<string, string | Array<{ action_type: string; value: string }>>;

export class TeamTripExportError extends Error {
  constructor(readonly code: string) {
    super(code); // Never copy upstream errors/URLs, which can contain credentials.
    this.name = "TeamTripExportError";
  }
}

function fail(code: string): never { throw new TeamTripExportError(code); }
function object(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_META_RESPONSE");
  return value as RecordValue;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 2000) fail("INVALID_META_RESPONSE");
  return value;
}
function isoDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("INVALID_PERIOD");
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail("INVALID_PERIOD");
  return date;
}

export function teamTripPeriod(params: URLSearchParams, now = new Date()): TeamTripPeriod {
  if ([...params.keys()].some((key) => key !== "since" && key !== "until") ||
      params.getAll("since").length !== 1 || params.getAll("until").length !== 1) fail("INVALID_PERIOD");
  const since = params.get("since")!;
  const until = params.get("until")!;
  const start = isoDate(since);
  const end = isoDate(until);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  if (!since.startsWith("2026-") || start.getUTCDay() !== 1 ||
      end.getTime() - start.getTime() !== 6 * 86400000 || until >= today) fail("INVALID_PERIOD");
  return { since, until };
}

function numeric(value: unknown, integer = false): string {
  if ((typeof value !== "string" && typeof value !== "number") ||
      String(value).trim() === "" || !Number.isFinite(Number(value)) || Number(value) < 0 ||
      (integer && !Number.isSafeInteger(Number(value)))) fail("INVALID_META_RESPONSE");
  return String(value);
}

function insight(value: unknown, period: TeamTripPeriod, currency: string, ad: boolean): Insight {
  const row = object(value);
  if (row.account_id !== ACCOUNT_ID || row.account_currency !== currency ||
      typeof row.date_start !== "string" || row.date_start !== row.date_stop ||
      row.date_start < period.since || row.date_start > period.until) fail("INVALID_META_SCOPE");
  isoDate(row.date_start);
  const clean: Insight = {
    account_id: ACCOUNT_ID, account_currency: currency,
    date_start: row.date_start, date_stop: row.date_start,
    spend: numeric(row.spend), impressions: numeric(row.impressions, true),
    clicks: numeric(row.clicks, true),
  };
  if (row.inline_link_clicks !== undefined) clean.inline_link_clicks = numeric(row.inline_link_clicks, true);
  if (ad) {
    for (const field of ["campaign_id", "adset_id", "ad_id"]) {
      const id = text(row[field]);
      if (!/^\d+$/.test(id)) fail("INVALID_META_RESPONSE");
      clean[field] = id;
    }
    for (const field of ["campaign_name", "adset_name", "ad_name", "objective"]) clean[field] = text(row[field]);
    // Missing actions stay missing: unavailable conversions must not become zeros.
    if (row.actions !== undefined) {
      if (!Array.isArray(row.actions)) fail("INVALID_META_RESPONSE");
      const seen = new Set<string>();
      clean.actions = row.actions.map((value) => {
        const action = object(value);
        const action_type = text(action.action_type);
        if (seen.has(action_type)) fail("DUPLICATE_META_ACTION");
        seen.add(action_type);
        return { action_type, value: numeric(action.value) };
      });
    }
  }
  return clean;
}

export async function fetchTeamTripMetaExport(period: TeamTripPeriod, now = new Date()) {
  // Defence in depth for future callers outside the HTTP handler.
  teamTripPeriod(new URLSearchParams(period), now);
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) fail("META_NOT_CONFIGURED");
  const deadline = Date.now() + 50000;
  async function graph(path: string, params: URLSearchParams): Promise<RecordValue> {
    const remaining = deadline - Date.now();
    if (remaining < 1000) fail("META_TIMEOUT");
    try {
      const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/act_${ACCOUNT_ID}${path}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
        redirect: "error", signal: AbortSignal.timeout(Math.min(remaining, 20000)),
      });
      if (!response.ok) fail("META_UNAVAILABLE");
      const payload = object(await response.json());
      if (payload.error) fail("META_UNAVAILABLE");
      return payload;
    } catch (error) {
      if (error instanceof TeamTripExportError) throw error;
      fail("META_UNAVAILABLE");
    }
  }
  const metadata = await graph("", new URLSearchParams({ fields: "account_id,name,currency,timezone_name" }));
  if (metadata.account_id !== ACCOUNT_ID || !["USD", "EUR", "RUB"].includes(String(metadata.currency))) fail("INVALID_META_SCOPE");
  const account = {
    account_id: ACCOUNT_ID, name: text(metadata.name), currency: text(metadata.currency),
    timezone_name: text(metadata.timezone_name),
  };
  async function pages(ad: boolean): Promise<Insight[]> {
    const params = new URLSearchParams({
      fields: ad ? AD_FIELDS : BASE_FIELDS, level: ad ? "ad" : "account",
      time_range: JSON.stringify(period), time_increment: "1", limit: "500",
      action_report_time: "impression", use_unified_attribution_setting: "true",
    });
    const rows: Insight[] = [];
    const cursors = new Set<string>();
    const keys = new Set<string>();
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const payload = await graph("/insights", params);
      if (!Array.isArray(payload.data)) fail("INVALID_META_RESPONSE");
      for (const value of payload.data) {
        const row = insight(value, period, account.currency, ad);
        const key = `${row.date_start}|${ad ? row.ad_id : ACCOUNT_ID}`;
        if (keys.has(key)) fail("DUPLICATE_META_ROW");
        keys.add(key);
        rows.push(row);
      }
      if (!payload.paging) return rows;
      const paging = object(payload.paging);
      if (!paging.next) return rows;
      // Never follow paging.next or return it to Sheets: it may contain the Meta token.
      const after = text(object(paging.cursors).after);
      if (cursors.has(after)) fail("INVALID_META_PAGING");
      cursors.add(after);
      params.set("after", after);
    }
    fail("META_PAGE_LIMIT");
  }
  const [details, controlRows] = await Promise.all([pages(true), pages(false)]);
  if (!details.length || !controlRows.length) fail("EMPTY_META_EXPORT");
  const sum = (rows: Insight[], field: string) => rows.reduce((total, row) => total + Number(row[field]), 0);
  if (Math.abs(sum(details, "spend") - sum(controlRows, "spend")) > 0.020001 ||
      sum(details, "impressions") !== sum(controlRows, "impressions") ||
      (details.concat(controlRows).every((row) => row.inline_link_clicks !== undefined) &&
       sum(details, "inline_link_clicks") !== sum(controlRows, "inline_link_clicks"))) fail("META_TOTAL_MISMATCH");
  return {
    schemaVersion: 1, source: "meta_live", generatedAt: new Date().toISOString(),
    period, account, details, controlRows,
  };
}
