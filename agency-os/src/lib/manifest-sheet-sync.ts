import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchManifestSheet, MANIFEST_PROJECT_ID, parseTelegramDistribution, parseVkDays, type SheetMetric } from "@/lib/manifest-sheet";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export async function syncManifestSheet(client: Client): Promise<{ ok: true; vkDays: number; telegramDays: number }> {
  const { data: project, error: projectError } = await client.from("projects").select("id,name").eq("id", MANIFEST_PROJECT_ID).maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project) throw new Error("Проект «Манифест / Прин» не найден в Agency OS");

  const [vkRows, telegramRows] = await Promise.all([
    fetchManifestSheet(603515662),
    fetchManifestSheet(94321028),
  ]);
  const metrics = [...parseVkDays(vkRows), ...parseTelegramDistribution(telegramRows)];
  if (metrics.length === 0) throw new Error("В таблице нет дневных рекламных данных");
  const unique = new Map<string, SheetMetric>();
  for (const metric of metrics) {
    const key = `${metric.platform}:${metric.accountExternalId}:${metric.campaignExternalId}:${metric.date}`;
    if (unique.has(key)) throw new Error(`Повторная строка ${key} в таблице`);
    unique.set(key, metric);
  }

  const accounts = [...new Map(metrics.map((row) => [`${row.platform}:${row.accountExternalId}`, row])).values()];
  const { data: accountRows, error: accountError } = await client.from("ad_accounts").upsert(
    accounts.map((row) => ({
      platform: row.platform,
      external_id: row.accountExternalId,
      name: row.platform === "vk" ? `${row.accountName} · расход без НДС` : row.accountName,
      currency: "RUB",
      project_id: MANIFEST_PROJECT_ID,
    })),
    { onConflict: "platform,external_id" },
  ).select("id,platform,external_id");
  if (accountError) throw new Error(accountError.message);
  const accountIds = new Map((accountRows ?? []).map((row) => [`${row.platform}:${row.external_id}`, row.id]));

  const campaigns = [...new Map(metrics.map((row) => [`${row.platform}:${row.accountExternalId}:${row.campaignExternalId}`, row])).values()];
  const { data: campaignRows, error: campaignError } = await client.from("ad_campaigns").upsert(
    campaigns.map((row) => ({
      ad_account_id: accountIds.get(`${row.platform}:${row.accountExternalId}`)!,
      external_id: row.campaignExternalId,
      name: row.campaignName,
      objective: row.goal,
      project_id: MANIFEST_PROJECT_ID,
    })),
    { onConflict: "ad_account_id,external_id" },
  ).select("id,ad_account_id,external_id");
  if (campaignError) throw new Error(campaignError.message);
  const campaignIds = new Map((campaignRows ?? []).map((row) => [`${row.ad_account_id}:${row.external_id}`, row.id]));

  const daily = metrics.map((row) => ({
    campaign_id: campaignIds.get(`${accountIds.get(`${row.platform}:${row.accountExternalId}`)}:${row.campaignExternalId}`)!,
    date: row.date, spend: row.spend, impressions: row.impressions, clicks: row.clicks,
    reach: 0,
  }));
  for (let index = 0; index < daily.length; index += 500) {
    const { error } = await client.from("ad_campaign_metrics").upsert(daily.slice(index, index + 500), { onConflict: "campaign_id,date" });
    if (error) throw new Error(error.message);
  }
  const conversions = metrics.filter((row) => row.goal !== null && row.results !== null).map((row) => ({
    campaign_id: campaignIds.get(`${accountIds.get(`${row.platform}:${row.accountExternalId}`)}:${row.campaignExternalId}`)!,
    date: row.date, action_type: row.goal!, count: row.results!, value: 0,
  }));
  for (let index = 0; index < conversions.length; index += 500) {
    const { error } = await client.from("ad_conversions").upsert(conversions.slice(index, index + 500), { onConflict: "campaign_id,date,action_type" });
    if (error) throw new Error(error.message);
  }
  return { ok: true, vkDays: metrics.filter((row) => row.platform === "vk").length, telegramDays: metrics.filter((row) => row.platform === "telegram_ads").length };
}
