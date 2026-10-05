import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsPeriod } from "@/lib/analytics-period";
import type { Database } from "@/lib/supabase/types";
import { fetchYandexCampaignReport, type YandexCampaignDay } from "@/lib/yandex-direct";

type Client = SupabaseClient<Database>;

/** Conversions by the campaign's key goals, as Yandex counts them without explicit Goals. */
export const YANDEX_CONVERSIONS = "yandex:conversions";

export type YandexSyncResult = {
  ok: boolean;
  message: string;
  accounts: { login: string; days: number; error?: string }[];
};

async function upsertInBatches<T>(rows: T[], write: (batch: T[]) => PromiseLike<{ error: { message: string } | null }>) {
  for (let index = 0; index < rows.length; index += 500) {
    const { error } = await write(rows.slice(index, index + 500));
    if (error) throw new Error(error.message);
  }
}

async function storeAccountReport(client: Client, account: { id: string; project_id: string }, rows: YandexCampaignDay[]) {
  const campaigns = [...new Map(rows.map((row) => [row.campaignId, row.campaignName])).entries()];
  if (campaigns.length === 0) return;
  const { data: campaignRows, error } = await client.from("ad_campaigns").upsert(
    campaigns.map(([externalId, name]) => ({ ad_account_id: account.id, external_id: externalId, name, project_id: account.project_id })),
    { onConflict: "ad_account_id,external_id" },
  ).select("id,external_id");
  if (error) throw new Error(error.message);
  const ids = new Map((campaignRows ?? []).map((row) => [row.external_id, row.id]));

  await upsertInBatches(rows.map((row) => ({
    campaign_id: ids.get(row.campaignId)!, date: row.date, spend: row.cost,
    impressions: row.impressions, clicks: row.clicks, reach: 0,
  })), (batch) => client.from("ad_campaign_metrics").upsert(batch, { onConflict: "campaign_id,date" }));

  await upsertInBatches(rows.filter((row) => row.conversions !== null).map((row) => ({
    campaign_id: ids.get(row.campaignId)!, date: row.date, action_type: YANDEX_CONVERSIONS,
    count: row.conversions!, value: 0,
  })), (batch) => client.from("ad_conversions").upsert(batch, { onConflict: "campaign_id,date,action_type" }));
}

/**
 * Read-only import for Yandex Direct accounts the owner linked to active projects.
 * One failing client never blocks the others.
 */
export async function syncYandexDirect(client: Client, period: AnalyticsPeriod, projectId?: string): Promise<YandexSyncResult> {
  let query = client.from("ad_accounts").select("id,external_id,project_id,projects!inner(stage)")
    .eq("platform", "yandex_direct").eq("is_active", true).not("project_id", "is", null)
    .in("projects.stage", ["launching", "active"]);
  if (projectId) query = query.eq("project_id", projectId);
  const { data: accounts, error } = await query;
  if (error) throw new Error(error.message);
  if (!accounts?.length) return { ok: false, message: "Нет кабинетов Яндекс.Директа, привязанных к активным проектам.", accounts: [] };

  const results: YandexSyncResult["accounts"] = [];
  for (const account of accounts) {
    try {
      const rows = await fetchYandexCampaignReport(account.external_id, period.from, period.to);
      await storeAccountReport(client, { id: account.id, project_id: account.project_id! }, rows);
      results.push({ login: account.external_id, days: rows.length });
    } catch (syncError) {
      results.push({ login: account.external_id, days: 0, error: syncError instanceof Error ? syncError.message : "Неизвестная ошибка" });
    }
  }
  const failed = results.filter((result) => result.error);
  const loaded = results.length - failed.length;
  return {
    ok: loaded > 0,
    message: `Яндекс.Директ: загружено кабинетов ${loaded} из ${results.length}.${failed.length ? ` Ошибки: ${failed.map((item) => `${item.login} — ${item.error}`).join("; ")}` : ""}`,
    accounts: results,
  };
}
