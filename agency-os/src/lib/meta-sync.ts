import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchMetaAccounts,
  fetchMetaCampaignInsights,
  fetchMetaCampaigns,
  fetchMetaCustomConversions,
  fetchMetaInsights,
  type MetaCampaign,
  type MetaCampaignDailyMetric,
  type MetaCustomConversion,
  type MetaDailyMetric,
} from "@/lib/meta-ads";
import type { Database } from "@/lib/supabase/types";

export type MetaSyncResult = { ok: boolean; message: string };

const GENERIC_TOKENS = new Set([
  "ads",
  "account",
  "new",
  "the",
  "com",
  "lab",
  "asia",
]);

type AgencySupabaseClient = SupabaseClient<Database>;

type AccountRow = {
  id: string;
  external_id: string;
  name: string | null;
  project_id: string | null;
};

type AccountPayload = {
  account: AccountRow;
  metrics: MetaDailyMetric[];
  campaigns: MetaCampaign[];
  campaignMetrics: MetaCampaignDailyMetric[];
  customConversions: MetaCustomConversion[];
};

type AccountSyncFailure = {
  label: string;
  message: string;
};

function matchProjectId(
  accountName: string | null,
  projects: { id: string; name: string }[],
): string | null {
  if (!accountName) return null;
  const normalizedAccountName = accountName.toLocaleLowerCase("ru-RU");
  for (const project of projects) {
    const tokens = project.name
      .toLocaleLowerCase("ru-RU")
      .split(/[^a-zа-я0-9]+/i)
      .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token));
    if (tokens.some((token) => normalizedAccountName.includes(token))) {
      return project.id;
    }
  }
  return null;
}

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function partitionAccountResults<T>(
  accounts: { external_id: string; name?: string | null }[],
  results: PromiseSettledResult<T>[],
): { payloads: T[]; failures: AccountSyncFailure[] } {
  const payloads: T[] = [];
  const failures: AccountSyncFailure[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      payloads.push(result.value);
      return;
    }
    const account = accounts[index];
    failures.push({
      label: account?.name?.trim() || account?.external_id || "Неизвестный кабинет",
      message:
        result.reason instanceof Error
          ? result.reason.message
          : "Meta не вернула данные по кабинету.",
    });
  });

  return { payloads, failures };
}

function skippedAccountsSuffix(failures: AccountSyncFailure[]): string {
  if (failures.length === 0) return "";
  const labels = failures.map((failure) => failure.label).join(", ");
  return ` Пропущено кабинетов без доступа: ${failures.length} (${labels}).`;
}

export async function syncMetaAdsData(
  supabase: AgencySupabaseClient,
  days: number,
): Promise<MetaSyncResult> {
  try {
    const accounts = await fetchMetaAccounts();
    if (accounts.length === 0) {
      return {
        ok: false,
        message:
          "Кабинеты не найдены. Проверьте токен и доступ системного пользователя.",
      };
    }

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id,name");
    if (projectsError) throw new Error(projectsError.message);
    const projectList = projects ?? [];

    const { data: upserted, error: accountsError } = await supabase
      .from("ad_accounts")
      .upsert(
        accounts.map((account) => ({
          platform: "meta" as const,
          external_id: account.externalId,
          name: account.name,
          currency: account.currency,
        })),
        { onConflict: "platform,external_id" },
      )
      .select("id,external_id,name,project_id");
    if (accountsError) throw new Error(accountsError.message);
    const accountRows = (upserted ?? []) as AccountRow[];

    for (const row of accountRows) {
      if (row.project_id) continue;
      const matchedProjectId = matchProjectId(row.name, projectList);
      if (!matchedProjectId) continue;
      const { error } = await supabase
        .from("ad_accounts")
        .update({ project_id: matchedProjectId })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      row.project_id = matchedProjectId;
    }

    const since = isoDaysAgo(days);
    const until = isoDaysAgo(0);
    const accountResults = await Promise.allSettled(
      accountRows.map(async (account) => {
        const [metrics, campaigns, campaignMetrics, customConversions] =
          await Promise.all([
            fetchMetaInsights(account.external_id, since, until),
            fetchMetaCampaigns(account.external_id),
            fetchMetaCampaignInsights(account.external_id, since, until),
            fetchMetaCustomConversions(account.external_id),
          ]);
        return {
          account,
          metrics,
          campaigns,
          campaignMetrics,
          customConversions,
        };
      }),
    );
    const { payloads, failures } = partitionAccountResults<AccountPayload>(
      accountRows,
      accountResults,
    );
    if (payloads.length === 0) {
      return {
        ok: false,
        message:
          "Не удалось загрузить ни один доступный кабинет Meta." +
          skippedAccountsSuffix(failures),
      };
    }

    let daysWritten = 0;
    let campaignCount = 0;
    let campaignDays = 0;
    let conversionRows = 0;
    let customConversionCount = 0;

    for (const {
      account,
      metrics,
      campaigns,
      campaignMetrics,
      customConversions,
    } of payloads) {
      if (metrics.length > 0) {
        const { error } = await supabase.from("ad_metrics").upsert(
          metrics.map((metric) => ({
            ad_account_id: account.id,
            date: metric.date,
            spend: metric.spend,
            impressions: metric.impressions,
            clicks: metric.clicks,
            leads: metric.leads,
          })),
          { onConflict: "ad_account_id,date" },
        );
        if (error) throw new Error(error.message);
        daysWritten += metrics.length;
      }

      if (customConversions.length > 0) {
        const { error } = await supabase
          .from("ad_custom_conversions")
          .upsert(
            customConversions.map((conversion) => ({
              account_id: account.id,
              conversion_id: conversion.conversionId,
              name: conversion.name,
            })),
            { onConflict: "account_id,conversion_id" },
          );
        if (error) throw new Error(error.message);
        customConversionCount += customConversions.length;
      }

      const campaignsByExternalId = new Map<string, MetaCampaign>();
      for (const campaign of campaigns) {
        campaignsByExternalId.set(campaign.externalId, campaign);
      }
      for (const metric of campaignMetrics) {
        if (campaignsByExternalId.has(metric.campaignExternalId)) continue;
        campaignsByExternalId.set(metric.campaignExternalId, {
          externalId: metric.campaignExternalId,
          name: metric.campaignName,
          objective: null,
          status: null,
        });
      }
      if (campaignsByExternalId.size === 0) continue;

      const { data: campaignRows, error: campaignsError } = await supabase
        .from("ad_campaigns")
        .upsert(
          [...campaignsByExternalId.values()].map((campaign) => ({
            ad_account_id: account.id,
            external_id: campaign.externalId,
            name: campaign.name,
            objective: campaign.objective,
            status: campaign.status,
          })),
          { onConflict: "ad_account_id,external_id" },
        )
        .select("id,external_id,project_id");
      if (campaignsError) throw new Error(campaignsError.message);
      campaignCount += (campaignRows ?? []).length;

      const orphanCampaignIds = (campaignRows ?? [])
        .filter((row) => !row.project_id)
        .map((row) => row.id);
      if (account.project_id && orphanCampaignIds.length > 0) {
        const { error } = await supabase
          .from("ad_campaigns")
          .update({ project_id: account.project_id })
          .in("id", orphanCampaignIds);
        if (error) throw new Error(error.message);
      }

      const campaignIdByExternalId = new Map(
        (campaignRows ?? []).map((row) => [row.external_id, row.id]),
      );
      const metricRows: Database["public"]["Tables"]["ad_campaign_metrics"]["Insert"][] = [];
      const conversionRowsToWrite: Database["public"]["Tables"]["ad_conversions"]["Insert"][] = [];

      for (const metric of campaignMetrics) {
        const campaignId = campaignIdByExternalId.get(
          metric.campaignExternalId,
        );
        if (!campaignId) continue;
        metricRows.push({
          campaign_id: campaignId,
          date: metric.date,
          spend: metric.spend,
          impressions: metric.impressions,
          clicks: metric.clicks,
          reach: metric.reach,
        });
        for (const conversion of metric.conversions) {
          conversionRowsToWrite.push({
            campaign_id: campaignId,
            date: metric.date,
            action_type: conversion.actionType,
            count: conversion.count,
            value: conversion.value,
          });
        }
      }

      for (const batch of chunk(metricRows, 500)) {
        const { error } = await supabase
          .from("ad_campaign_metrics")
          .upsert(batch, { onConflict: "campaign_id,date" });
        if (error) throw new Error(error.message);
      }
      campaignDays += metricRows.length;

      for (const batch of chunk(conversionRowsToWrite, 500)) {
        const { error } = await supabase
          .from("ad_conversions")
          .upsert(batch, { onConflict: "campaign_id,date,action_type" });
        if (error) throw new Error(error.message);
      }
      conversionRows += conversionRowsToWrite.length;
    }

    return {
      ok: true,
      message:
        `Готово за ${days} дн.: кабинетов ${payloads.length} из ${accountRows.length}, ` +
        `дней по кабинетам ${daysWritten}, кампаний ${campaignCount}, ` +
        `дней по кампаниям ${campaignDays}, конверсий ${conversionRows}, ` +
        `своих конверсий ${customConversionCount}.` +
        skippedAccountsSuffix(failures),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Ошибка синхронизации Meta.",
    };
  }
}
