import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsPeriod } from "@/lib/analytics-period";
import type { Database } from "@/lib/supabase/types";
import { fetchTelegramAdDays, fetchTonRubRate } from "@/lib/telegram-ads";
import { ensureVkToken, fetchVkCampaignDays, type VkCredential } from "@/lib/vk-ads";
import { fetchYandexCampaignReport } from "@/lib/yandex-direct";

/** Service-role client: credentials are readable only by the server. */
type Service = SupabaseClient<Database>;

export const CONNECTED_PLATFORMS = ["telegram_ads", "vk", "yandex_direct"] as const;
export type ConnectedPlatform = (typeof CONNECTED_PLATFORMS)[number];

export type TelegramSecret = { token: string };
export type YandexSecret = { token: string; clientLogin?: string };
export type ConnectedSecret = TelegramSecret | VkCredential | YandexSecret;

/** One normalized day of one campaign, ready for the shared ad tables. */
export type CampaignDay = { campaignId: string; name: string; date: string; spend: number; impressions: number; clicks: number; results: number | null; actionType: string };

export async function saveSecret(client: Service, accountId: string, secret: ConnectedSecret, userId: string) {
  const { error } = await client.rpc("save_ad_account_secret", { p_account_id: accountId, p_secret: JSON.stringify(secret), p_user_id: userId });
  if (error) throw new Error(`Не удалось сохранить ключ: ${error.message}`);
}

async function readSecret<T extends ConnectedSecret>(client: Service, accountId: string): Promise<T> {
  const { data, error } = await client.rpc("read_ad_account_secret", { p_account_id: accountId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Ключ кабинета не найден — подключите кабинет заново.");
  return JSON.parse(data) as T;
}

/** Fetches daily campaign statistics with the stored key; may refresh the stored VK token. */
export async function fetchConnectedDays(client: Service, account: { id: string; platform: ConnectedPlatform }, period: AnalyticsPeriod): Promise<CampaignDay[]> {
  if (account.platform === "telegram_ads") {
    const { token } = await readSecret<TelegramSecret>(client, account.id);
    const [days, rate] = await Promise.all([fetchTelegramAdDays(token, period.from, period.to), fetchTonRubRate()]);
    return days.map((day) => ({ campaignId: day.adId, name: day.title, date: day.date, spend: Math.round(day.spendTon * rate * 100) / 100, impressions: day.views, clicks: day.clicks, results: day.joins, actionType: "telegram:joins" }));
  }
  if (account.platform === "vk") {
    const stored = await readSecret<VkCredential>(client, account.id);
    const { credential, changed } = await ensureVkToken(stored);
    if (changed) {
      const { error } = await client.rpc("save_ad_account_secret", { p_account_id: account.id, p_secret: JSON.stringify(credential), p_user_id: null });
      if (error) throw new Error(error.message);
    }
    const days = await fetchVkCampaignDays(credential.accessToken!, period.from, period.to);
    return days.map((day) => ({ campaignId: day.campaignId, name: day.name, date: day.date, spend: day.spend, impressions: day.impressions, clicks: day.clicks, results: day.goals, actionType: "vk:Цели VK Рекламы" }));
  }
  const secret = await readSecret<YandexSecret>(client, account.id);
  const rows = await fetchYandexCampaignReport(secret, period.from, period.to);
  return rows.map((row) => ({ campaignId: row.campaignId, name: row.campaignName, date: row.date, spend: row.cost, impressions: row.impressions, clicks: row.clicks, results: row.conversions, actionType: "yandex:conversions" }));
}

async function inBatches<T>(rows: T[], write: (batch: T[]) => PromiseLike<{ error: { message: string } | null }>) {
  for (let index = 0; index < rows.length; index += 500) {
    const { error } = await write(rows.slice(index, index + 500));
    if (error) throw new Error(error.message);
  }
}

export async function storeCampaignDays(client: Service, account: { id: string; project_id: string }, days: CampaignDay[]) {
  const campaigns = [...new Map(days.map((day) => [day.campaignId, day.name])).entries()];
  if (!campaigns.length) return;
  const { data, error } = await client.from("ad_campaigns").upsert(
    campaigns.map(([externalId, name]) => ({ ad_account_id: account.id, external_id: externalId, name, project_id: account.project_id })),
    { onConflict: "ad_account_id,external_id" },
  ).select("id,external_id");
  if (error) throw new Error(error.message);
  const ids = new Map((data ?? []).map((row) => [row.external_id, row.id]));
  await inBatches(days.map((day) => ({ campaign_id: ids.get(day.campaignId)!, date: day.date, spend: day.spend, impressions: day.impressions, clicks: day.clicks, reach: 0 })),
    (batch) => client.from("ad_campaign_metrics").upsert(batch, { onConflict: "campaign_id,date" }));
  await inBatches(days.filter((day) => day.results !== null).map((day) => ({ campaign_id: ids.get(day.campaignId)!, date: day.date, action_type: day.actionType, count: day.results!, value: 0 })),
    (batch) => client.from("ad_conversions").upsert(batch, { onConflict: "campaign_id,date,action_type" }));
}

export type ConnectedSyncResult = { ok: boolean; message: string; accounts: { name: string; days: number; error?: string }[] };

/** Imports every connected account of active projects (or of one project); one failure never blocks the rest. */
export async function syncConnectedAccounts(client: Service, period: AnalyticsPeriod, projectId?: string): Promise<ConnectedSyncResult> {
  let query = client.from("ad_account_credentials")
    .select("ad_account_id, ad_accounts!inner(id,name,platform,project_id,is_active,projects!inner(stage))")
    .eq("ad_accounts.is_active", true)
    .in("ad_accounts.projects.stage", ["launching", "active"]);
  if (projectId) query = query.eq("ad_accounts.project_id", projectId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const accounts = (data ?? []).map((row) => row.ad_accounts as unknown as { id: string; name: string | null; platform: ConnectedPlatform; project_id: string });
  if (!accounts.length) return { ok: false, message: "Нет подключённых кабинетов в активных проектах.", accounts: [] };

  const results: ConnectedSyncResult["accounts"] = [];
  for (const account of accounts) {
    const name = account.name ?? account.platform;
    try {
      const days = await fetchConnectedDays(client, account, period);
      await storeCampaignDays(client, account, days);
      await client.from("ad_account_credentials").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("ad_account_id", account.id);
      results.push({ name, days: days.length });
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message.slice(0, 300) : "Неизвестная ошибка";
      await client.from("ad_account_credentials").update({ last_error: message }).eq("ad_account_id", account.id);
      results.push({ name, days: 0, error: message });
    }
  }
  const failed = results.filter((result) => result.error);
  return {
    ok: failed.length < results.length,
    message: `Загружено кабинетов: ${results.length - failed.length} из ${results.length}.${failed.length ? ` Ошибки: ${failed.map((item) => `${item.name} — ${item.error}`).join("; ")}` : ""}`,
    accounts: results,
  };
}
