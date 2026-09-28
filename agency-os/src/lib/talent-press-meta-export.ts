import "server-only";

import { fetchMetaAccounts } from "@/lib/meta-ads";

const GRAPH_VERSION = "v23.0";
const GOAL = "offsite_conversion.custom.855682077406013";

type Action = { action_type?: string; value?: string };
type Insight = {
  campaign_name?: string;
  country?: string;
  spend?: string;
  reach?: string;
  impressions?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: Action[];
};
type GraphResponse = {
  data?: Insight[];
  paging?: { next?: string };
  error?: { message?: string };
};

export type ExportPeriod = { start: string; end: string; kind: "week" | "month" };
export type ExportRow = {
  period: string;
  campaign: string;
  country: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  leads: number;
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function exportPeriods(now = new Date()): ExportPeriod[] {
  // Meta's account timezone determines today's incomplete data; yesterday is stable.
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const periods: ExportPeriod[] = [];
  for (let offset = 0; offset < 5; offset += 1) {
    const end = new Date(yesterday);
    end.setUTCDate(end.getUTCDate() - offset * 7);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 3) % 7)); // Thursday
    const fullEnd = new Date(start);
    fullEnd.setUTCDate(fullEnd.getUTCDate() + 6);
    periods.push({ start: isoDate(start), end: isoDate(fullEnd < yesterday ? fullEnd : yesterday), kind: "week" });
  }
  for (let offset = 0; offset < 2; offset += 1) {
    const start = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth() - offset, 1));
    const fullEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    periods.push({ start: isoDate(start), end: isoDate(fullEnd < yesterday ? fullEnd : yesterday), kind: "month" });
  }
  return periods;
}

export async function fetchTalentPressMetaExport(now = new Date()): Promise<{
  asOf: string;
  periods: Array<ExportPeriod & { rows: ExportRow[] }>;
}> {
  const accounts = (await fetchMetaAccounts()).filter((account) => account.name?.trim() === "Talent Press 5");
  if (accounts.length !== 1 || accounts[0].currency !== "USD") {
    throw new Error("Кабинет Talent Press 5 в USD не найден однозначно");
  }
  const account = accounts[0];
  const periods = exportPeriods(now);
  const result = [];
  for (const period of periods) {
    const rows = await fetchPeriod(account.externalId, period);
    result.push({ ...period, rows });
  }
  return { asOf: periods[0].end, periods: result };
}

async function fetchPeriod(accountId: string, period: ExportPeriod): Promise<ExportRow[]> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) throw new Error("META_ACCESS_TOKEN отсутствует");
  const params = new URLSearchParams({
    fields: "campaign_name,spend,reach,impressions,clicks,inline_link_clicks,actions",
    level: "campaign",
    breakdowns: "country",
    time_range: JSON.stringify({ since: period.start, until: period.end }),
    limit: "500",
  });
  let url: string | undefined = `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/insights?${params}`;
  const rows: ExportRow[] = [];
  let page = 0;
  while (url && page < 30) {
    page += 1;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload = await response.json() as GraphResponse;
    if (!response.ok) throw new Error(`Meta Insights ${response.status}`);
    for (const item of payload.data ?? []) {
      const spend = Number(item.spend ?? 0);
      if (!(spend > 0)) continue;
      rows.push({
        period: `${period.start} - ${period.end}`,
        campaign: item.campaign_name ?? "",
        country: item.country ?? "",
        spend,
        reach: Number(item.reach ?? 0),
        impressions: Number(item.impressions ?? 0),
        clicks: Number(item.clicks ?? 0),
        linkClicks: Number(item.inline_link_clicks ?? 0),
        leads: (item.actions ?? []).filter((action) => action.action_type === GOAL)
          .reduce((sum, action) => sum + Number(action.value ?? 0), 0),
      });
    }
    url = payload.paging?.next;
  }
  if (url) throw new Error("Meta Insights pagination limit reached");
  return rows;
}
