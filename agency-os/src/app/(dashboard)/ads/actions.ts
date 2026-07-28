"use server";

import { revalidatePath } from "next/cache";

import {
  fetchMetaAccounts,
  fetchMetaCampaignInsights,
  fetchMetaCampaigns,
  fetchMetaInsights,
  type MetaCampaign,
  type MetaCampaignDailyMetric,
  type MetaDailyMetric,
} from "@/lib/meta-ads";
import { createClient } from "@/lib/supabase/server";

export type SyncMetaState = { ok: boolean; message: string } | undefined;

const GENERIC_TOKENS = new Set([
  "ads",
  "account",
  "new",
  "the",
  "com",
  "lab",
  "asia",
]);

// Глубина исторической догрузки, выбирается в форме синхронизации.
const ALLOWED_DAYS = [30, 90, 180, 365];
const DEFAULT_DAYS = 30;

// Осторожное авто-сопоставление кабинета с проектом по совпадению слова в названии.
function matchProjectId(
  accountName: string | null,
  projects: { id: string; name: string }[],
): string | null {
  if (!accountName) return null;
  const acc = accountName.toLocaleLowerCase("ru-RU");
  for (const project of projects) {
    const tokens = project.name
      .toLocaleLowerCase("ru-RU")
      .split(/[^a-zа-я0-9]+/i)
      .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token));
    if (tokens.some((token) => acc.includes(token))) return project.id;
  }
  return null;
}

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function parseDays(formData: FormData | undefined): number {
  const raw = Number(formData?.get("days"));
  return ALLOWED_DAYS.includes(raw) ? raw : DEFAULT_DAYS;
}

// PostgREST не любит гигантские тела запроса — пишем пачками.
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

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
};

export async function syncMetaAds(
  _prevState: SyncMetaState,
  formData?: FormData,
): Promise<SyncMetaState> {
  const supabase = await createClient();
  const days = parseDays(formData);

  try {
    const accounts = await fetchMetaAccounts();
    if (accounts.length === 0) {
      return {
        ok: false,
        message:
          "Кабинеты не найдены. Проверьте, что токен выдан и кабинеты назначены системному пользователю.",
      };
    }

    const { data: projects } = await supabase.from("projects").select("id,name");
    const projectList = projects ?? [];

    // 1) Обновляем/создаём кабинеты (project_id не трогаем — ручную привязку сохраняем).
    const { data: upserted, error: accErr } = await supabase
      .from("ad_accounts")
      .upsert(
        accounts.map((a) => ({
          platform: "meta",
          external_id: a.externalId,
          name: a.name,
          currency: a.currency,
        })),
        { onConflict: "platform,external_id" },
      )
      .select("id,external_id,name,project_id");
    if (accErr) throw new Error(accErr.message);
    const accountRows = (upserted ?? []) as AccountRow[];

    // 2) Авто-привязка проекта для кабинетов без привязки.
    for (const row of accountRows) {
      if (row.project_id) continue;
      const matched = matchProjectId(row.name, projectList);
      if (!matched) continue;
      await supabase
        .from("ad_accounts")
        .update({ project_id: matched })
        .eq("id", row.id);
      row.project_id = matched;
    }

    // 3) Тянем из Meta всё по каждому кабинету (кабинеты независимы — параллельно).
    const since = isoDaysAgo(days);
    const until = isoDaysAgo(0);
    const payloads: AccountPayload[] = await Promise.all(
      accountRows.map(async (account) => {
        const [metrics, campaigns, campaignMetrics] = await Promise.all([
          fetchMetaInsights(account.external_id, since, until),
          fetchMetaCampaigns(account.external_id),
          fetchMetaCampaignInsights(account.external_id, since, until),
        ]);
        return { account, metrics, campaigns, campaignMetrics };
      }),
    );

    let daysWritten = 0;
    let campaignCount = 0;
    let campaignDays = 0;
    let conversionRows = 0;

    for (const { account, metrics, campaigns, campaignMetrics } of payloads) {
      // 3a) Суточные метрики кабинета (как в пилоте).
      if (metrics.length > 0) {
        const { error: mErr } = await supabase.from("ad_metrics").upsert(
          metrics.map((m) => ({
            ad_account_id: account.id,
            date: m.date,
            spend: m.spend,
            impressions: m.impressions,
            clicks: m.clicks,
            leads: m.leads,
          })),
          { onConflict: "ad_account_id,date" },
        );
        if (mErr) throw new Error(mErr.message);
        daysWritten += metrics.length;
      }

      // 3b) Кампании. В статистике попадаются кампании, которых уже нет в списке
      // (удалённые/архивные) — их тоже заводим, чтобы не потерять расход.
      const campaignByExternal = new Map<string, MetaCampaign>();
      for (const campaign of campaigns) {
        campaignByExternal.set(campaign.externalId, campaign);
      }
      for (const row of campaignMetrics) {
        if (campaignByExternal.has(row.campaignExternalId)) continue;
        campaignByExternal.set(row.campaignExternalId, {
          externalId: row.campaignExternalId,
          name: row.campaignName,
          objective: null,
          status: null,
        });
      }
      if (campaignByExternal.size === 0) continue;

      const { data: campaignRows, error: cErr } = await supabase
        .from("ad_campaigns")
        .upsert(
          [...campaignByExternal.values()].map((campaign) => ({
            ad_account_id: account.id,
            external_id: campaign.externalId,
            name: campaign.name,
            objective: campaign.objective,
            status: campaign.status,
          })),
          { onConflict: "ad_account_id,external_id" },
        )
        .select("id,external_id,project_id");
      if (cErr) throw new Error(cErr.message);
      campaignCount += (campaignRows ?? []).length;

      // 3c) Кампания без привязки наследует проект кабинета; ручной выбор не трогаем.
      const orphans = (campaignRows ?? [])
        .filter((row) => !row.project_id)
        .map((row) => row.id);
      if (account.project_id && orphans.length > 0) {
        const { error: pErr } = await supabase
          .from("ad_campaigns")
          .update({ project_id: account.project_id })
          .in("id", orphans);
        if (pErr) throw new Error(pErr.message);
      }

      const idByExternal = new Map(
        (campaignRows ?? []).map((row) => [row.external_id, row.id]),
      );

      // 3d) Суточные метрики кампаний + КАЖДЫЙ action_type в ad_conversions.
      const metricRows: {
        campaign_id: string;
        date: string;
        spend: number;
        impressions: number;
        clicks: number;
        reach: number;
      }[] = [];
      const convRows: {
        campaign_id: string;
        date: string;
        action_type: string;
        count: number;
        value: number;
      }[] = [];
      for (const row of campaignMetrics) {
        const campaignId = idByExternal.get(row.campaignExternalId);
        if (!campaignId) continue;
        metricRows.push({
          campaign_id: campaignId,
          date: row.date,
          spend: row.spend,
          impressions: row.impressions,
          clicks: row.clicks,
          reach: row.reach,
        });
        for (const conversion of row.conversions) {
          convRows.push({
            campaign_id: campaignId,
            date: row.date,
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

      for (const batch of chunk(convRows, 500)) {
        const { error } = await supabase
          .from("ad_conversions")
          .upsert(batch, { onConflict: "campaign_id,date,action_type" });
        if (error) throw new Error(error.message);
      }
      conversionRows += convRows.length;
    }

    revalidatePath("/ads");
    revalidatePath("/");
    return {
      ok: true,
      message:
        `Готово за ${days} дн.: кабинетов ${accountRows.length}, ` +
        `дней по кабинетам ${daysWritten}, кампаний ${campaignCount}, ` +
        `дней по кампаниям ${campaignDays}, конверсий ${conversionRows}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Ошибка синхронизации Meta.",
    };
  }
}
