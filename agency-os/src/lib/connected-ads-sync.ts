import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsPeriod } from "@/lib/analytics-period";
import type { Database } from "@/lib/supabase/types";
import { fetchTelegramAdDays, fetchTonRubRates } from "@/lib/telegram-ads";
import { ensureVkToken, fetchVkCampaignDays, type VkCredential } from "@/lib/vk-ads";
import { fetchYandexCampaignInfo, fetchYandexGoalReport, fetchYandexGoals, readYandexGoalCounters } from "@/lib/yandex-direct";
import { chooseYandexSyncGoals, parseYandexGoals, yandexGoalAction } from "@/lib/yandex-goals";

/** Service-role client: credentials are readable only by the server. */
type Service = SupabaseClient<Database>;

export const CONNECTED_PLATFORMS = ["telegram_ads", "vk", "yandex_direct"] as const;
export type ConnectedPlatform = (typeof CONNECTED_PLATFORMS)[number];

export type TelegramSecret = { token: string };
export type YandexSecret = { token: string; clientLogin?: string };
export type ConnectedSecret = TelegramSecret | VkCredential | YandexSecret;

/** One normalized day of one campaign, ready for the shared ad tables. */
export type CampaignDay = { campaignId: string; name: string; date: string; spend: number; impressions: number; clicks: number; results: number | null; actionType: string; goalResults?: { action: string; count: number | null; value?: number | null }[]; counterIds?: string[]; status?: string; spendIncludesVat?: boolean };

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

/** Owner goal settings, direction goals and goals with results in the last 60 days. */
async function readGoalPreferences(client: Service, accountId: string, projectId: string) {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const [settings, directions] = await Promise.all([
    client.from("project_ad_goal_settings").select("goal_key,hidden,is_primary").eq("project_id", projectId).like("goal_key", "yandex:%"),
    client.from("project_ad_directions").select("primary_goal").eq("project_id", projectId).eq("is_active", true),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  if (directions.error) throw new Error(directions.error.message);
  const recentGoalIds = new Set<string>();
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await client.from("ad_conversions").select("action_type, ad_campaigns!inner(ad_account_id)")
      .eq("ad_campaigns.ad_account_id", accountId).like("action_type", "yandex_goal:%").gt("count", 0).gte("date", since)
      .order("date", { ascending: false }).range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) { const id = row.action_type.split(":")[1]; if (id) recentGoalIds.add(id); }
    if ((data?.length ?? 0) < 1000) break;
  }
  return { settings: settings.data ?? [], requiredKeys: (directions.data ?? []).map((row) => row.primary_goal), recentGoalIds };
}

/** Fetches daily campaign statistics with the stored key; may refresh the stored VK token. */
export async function fetchConnectedDays(client: Service, account: { id: string; platform: ConnectedPlatform }, period: AnalyticsPeriod, selectedYandexGoalIds?: string[]): Promise<CampaignDay[]> {
  if (account.platform === "telegram_ads") {
    const { token } = await readSecret<TelegramSecret>(client, account.id);
    const days = await fetchTelegramAdDays(token, period.from, period.to);
    const rateOn = days.some((day) => day.spendTon > 0) ? await fetchTonRubRates(period.from) : () => 1;
    return days.map((day) => ({ campaignId: day.adId, name: day.title, date: day.date, spend: Math.round(day.spendTon * rateOn(day.date) * 100) / 100, impressions: day.views, clicks: day.clicks,
      results: null, actionType: "telegram:joins",
      goalResults: [{ action: "telegram:joins", count: day.joins }, { action: "telegram:actions", count: day.actions }],
    }));
  }
  if (account.platform === "vk") {
    const stored = await readSecret<VkCredential>(client, account.id);
    const { credential, changed } = await ensureVkToken(stored);
    if (changed) {
      const { error } = await client.rpc("save_ad_account_secret", { p_account_id: account.id, p_secret: JSON.stringify(credential), p_user_id: null });
      if (error) throw new Error(error.message);
    }
    const days = await fetchVkCampaignDays(credential.accessToken!, period.from, period.to);
    return days.map((day) => ({ campaignId: day.campaignId, name: day.name, date: day.date, spend: day.spend, impressions: day.impressions, clicks: day.clicks,
      results: null, actionType: "vk:Цели VK Рекламы",
      goalResults: [{ action: "vk:Цели VK Рекламы", count: day.goals }],
    }));
  }
  const secret = await readSecret<YandexSecret>(client, account.id);
  const [info, stored] = await Promise.all([fetchYandexCampaignInfo(secret), client.from('ad_accounts').select('yandex_goals,project_id').eq('id', account.id).single()]);
  if (stored.error) throw new Error(stored.error.message);
  if (!stored.data.project_id) throw new Error('Кабинет не привязан к проекту.');
  // GetRetargetingGoals is rate-limited independently of Reports. A daily sync
  // must use the already verified catalog instead of rediscovering it each time.
  const cachedGoals = parseYandexGoals(stored.data.yandex_goals);
  const discovered = cachedGoals.length ? cachedGoals : await fetchYandexGoals(secret);
  // Preserve explicitly verified counter IDs: Live 4 returns a domain, not a counter ID.
  const counters = new Map(parseYandexGoals(stored.data.yandex_goals).map((goal) => [goal.id, goal.counterId]));
  const knownCounters = await readYandexGoalCounters(secret, info.flatMap((c) => c.counterIds));
  for (const [id, counter] of knownCounters) counters.set(id, counter);
  const goals = discovered.map((goal) => ({ ...goal, counterId: counters.get(goal.id) ?? null }));
  if (!cachedGoals.length || knownCounters.size) {
    const { error } = await client.from('ad_accounts').update({ yandex_goals: goals }).eq('id', account.id);
    if (error) throw new Error(error.message);
  }
  if (info.length) {
    const { error: campaignError } = await client.from('ad_campaigns').upsert(info.map((c) => ({ ad_account_id: account.id, external_id: c.id, project_id: stored.data.project_id, name: c.name, status: c.status, metrika_counter_ids: c.counterIds })), { onConflict: 'ad_account_id,external_id' });
    if (campaignError) throw new Error(campaignError.message);
  }
  const reportGoals = selectedYandexGoalIds === undefined
    ? chooseYandexSyncGoals({ catalog: goals, ...(await readGoalPreferences(client, account.id, stored.data.project_id)) })
    : goals.filter((goal) => selectedYandexGoalIds.includes(goal.id));
  if (selectedYandexGoalIds?.some((id) => !reportGoals.some((goal) => goal.id === id)))
    throw new Error('Настроенная цель статуса отсутствует в каталоге целей кабинета.');
  const rows = await fetchYandexGoalReport(secret, period.from, period.to, reportGoals);
  const byId = new Map(info.map((campaign) => [campaign.id, campaign]));
  return rows.map((row) => ({ campaignId: row.campaignId, name: row.campaignName, date: row.date, spend: row.cost, impressions: row.impressions, clicks: row.clicks, results: null, actionType: "yandex:conversions", spendIncludesVat: true,
    counterIds: byId.get(row.campaignId)?.counterIds ?? [], status: byId.get(row.campaignId)?.status,
    goalResults: Object.entries(row.goals ?? {}).map(([id, count]) => ({ action: yandexGoalAction(id), count, value: row.goalValues?.[id] ?? null })),
  }));
}

async function inBatches<T>(rows: T[], write: (batch: T[]) => PromiseLike<{ error: { message: string } | null }>) {
  for (let index = 0; index < rows.length; index += 500) {
    const { error } = await write(rows.slice(index, index + 500));
    if (error) throw new Error(error.message);
  }
}

export async function storeCampaignDays(client: Service, account: { id: string; project_id: string }, days: CampaignDay[]) {
  const campaigns = [...new Map(days.map((day) => [day.campaignId, day])).entries()];
  if (!campaigns.length) return;
  const { data, error } = await client.from("ad_campaigns").upsert(
    campaigns.map(([externalId, day]) => ({ ad_account_id: account.id, external_id: externalId, name: day.name, project_id: account.project_id,
      ...(day.counterIds ? { metrika_counter_ids: day.counterIds } : {}), ...(day.status ? { status: day.status } : {}),
    })),
    { onConflict: "ad_account_id,external_id" },
  ).select("id,external_id");
  if (error) throw new Error(error.message);
  const ids = new Map((data ?? []).map((row) => [row.external_id, row.id]));
  await inBatches(days.map((day) => ({ campaign_id: ids.get(day.campaignId)!, date: day.date, spend: day.spend, impressions: day.impressions, clicks: day.clicks, reach: 0, spend_includes_vat: day.spendIncludesVat ?? false })),
    (batch) => client.from("ad_campaign_metrics").upsert(batch, { onConflict: "campaign_id,date" }));
  await inBatches(days.flatMap((day) => (day.goalResults ?? (day.results !== null ? [{ action: day.actionType, count: day.results }] : []))
    .map((goal) => ({ campaign_id: ids.get(day.campaignId)!, date: day.date, action_type: goal.action, count: goal.count ?? 0, is_measured: goal.count !== null, value: goal.value ?? 0, value_is_measured: goal.value !== null && goal.value !== undefined }))),
    (batch) => client.from("ad_conversions").upsert(batch, { onConflict: "campaign_id,date,action_type" }));
}

export type ConnectedSyncResult = { ok: boolean; message: string; accounts: { name: string; days: number; error?: string }[] };

/** Accounts imported at the same time; Yandex limits report queues per advertiser, not across them. */
const SYNC_CONCURRENCY = 3;
/** Leave headroom under the 300 s function limit so finished accounts are always recorded. */
const SYNC_BUDGET_MS = 240_000;

/**
 * Imports every connected account of active projects (or of one project); one failure never blocks the rest.
 * Least recently updated accounts go first, a few at a time, so one slow account cannot starve the others.
 * With `staleAfterHours` only accounts not updated within that window are imported (catch-up run).
 */
export async function syncConnectedAccounts(client: Service, period: AnalyticsPeriod, projectId?: string, { staleAfterHours }: { staleAfterHours?: number } = {}): Promise<ConnectedSyncResult> {
  let query = client.from("ad_account_credentials")
    .select("ad_account_id, ad_accounts!inner(id,name,platform,project_id,is_active,last_sync_at,projects!inner(stage))")
    .eq("ad_accounts.is_active", true)
    .in("ad_accounts.projects.stage", ["launching", "active"]);
  if (projectId) query = query.eq("ad_accounts.project_id", projectId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const staleBefore = staleAfterHours === undefined ? null : Date.now() - staleAfterHours * 3_600_000;
  const accounts = (data ?? []).map((row) => row.ad_accounts as unknown as { id: string; name: string | null; platform: ConnectedPlatform; project_id: string; last_sync_at: string | null })
    .filter((account) => staleBefore === null || !account.last_sync_at || Date.parse(account.last_sync_at) < staleBefore)
    .sort((left, right) => (left.last_sync_at ? Date.parse(left.last_sync_at) : 0) - (right.last_sync_at ? Date.parse(right.last_sync_at) : 0));
  if (!accounts.length) return { ok: staleBefore !== null, message: staleBefore !== null ? "Все кабинеты уже обновлены." : "Нет подключённых кабинетов в активных проектах.", accounts: [] };

  const startedAt = Date.now();
  const results: ConnectedSyncResult["accounts"] = [];
  const skipped: string[] = [];
  const queue = [...accounts];
  const syncOne = async (account: (typeof accounts)[number]) => {
    const name = account.name ?? account.platform;
    try {
      const days = await fetchConnectedDays(client, account, period);
      await storeCampaignDays(client, account, days);
      await client.from("ad_account_credentials").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("ad_account_id", account.id);
      await client.from("ad_accounts").update({ last_sync_at: new Date().toISOString(), last_sync_error: null }).eq("id", account.id);
      results.push({ name, days: days.length });
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message.slice(0, 300) : "Неизвестная ошибка";
      await client.from("ad_account_credentials").update({ last_error: message }).eq("ad_account_id", account.id);
      await client.from("ad_accounts").update({ last_sync_error: message }).eq("id", account.id);
      results.push({ name, days: 0, error: message });
    }
  };
  await Promise.all(Array.from({ length: Math.min(SYNC_CONCURRENCY, queue.length) }, async () => {
    for (let account = queue.shift(); account; account = queue.shift()) {
      if (Date.now() - startedAt > SYNC_BUDGET_MS) { skipped.push(account.name ?? account.platform); continue; }
      await syncOne(account);
    }
  }));
  const failed = results.filter((result) => result.error);
  return {
    ok: results.length > 0 && failed.length < results.length,
    message: `Загружено кабинетов: ${results.length - failed.length} из ${accounts.length}.${failed.length ? ` Ошибки: ${failed.map((item) => `${item.name} — ${item.error}`).join("; ")}` : ""}${skipped.length ? ` Не успели, обновятся следующим запуском: ${skipped.join(", ")}.` : ""}`,
    accounts: results,
  };
}
