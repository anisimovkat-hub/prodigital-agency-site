"use server";

import { revalidatePath } from "next/cache";

import {
  fetchMetaAccounts,
  fetchMetaAdInsights,
  fetchMetaAds,
  fetchMetaAdsetInsights,
  fetchMetaAdsets,
  fetchMetaCampaignInsights,
  fetchMetaCampaigns,
  fetchMetaCustomConversions,
  fetchMetaInsights,
  type MetaAd,
  type MetaAdset,
  type MetaCampaign,
  type MetaCampaignDailyMetric,
  type MetaCustomConversion,
  type MetaDailyMetric,
  type MetaEntityDailyMetric,
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
  customConversions: MetaCustomConversion[];
};

type AccountSyncFailure = {
  label: string;
  message: string;
};

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
    const accountResults = await Promise.allSettled(
      accountRows.map(async (account) => {
        const [metrics, campaigns, campaignMetrics, customConversions] =
          await Promise.all([
            fetchMetaInsights(account.external_id, since, until),
            fetchMetaCampaigns(account.external_id),
            fetchMetaCampaignInsights(account.external_id, since, until),
            fetchMetaCustomConversions(account.external_id),
          ]);
        return { account, metrics, campaigns, campaignMetrics, customConversions };
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
    let customConvCount = 0;

    for (const {
      account,
      metrics,
      campaigns,
      campaignMetrics,
      customConversions,
    } of payloads) {
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

      // 3a-2) Справочник кастомных конверсий кабинета (id → имя).
      if (customConversions.length > 0) {
        const { error: ccErr } = await supabase
          .from("ad_custom_conversions")
          .upsert(
            customConversions.map((c) => ({
              account_id: account.id,
              conversion_id: c.conversionId,
              name: c.name,
            })),
            { onConflict: "account_id,conversion_id" },
          );
        if (ccErr) throw new Error(ccErr.message);
        customConvCount += customConversions.length;
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

    revalidatePath("/analytics");
    revalidatePath("/");
    return {
      ok: true,
      message:
        `Готово за ${days} дн.: кабинетов ${payloads.length} из ${accountRows.length}, ` +
        `дней по кабинетам ${daysWritten}, кампаний ${campaignCount}, ` +
        `дней по кампаниям ${campaignDays}, конверсий ${conversionRows}, ` +
        `своих конверсий ${customConvCount}.` +
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

type AdSetRowDb = { id: string; external_id: string };
type AdRowDb = { id: string; external_id: string };
type AdDetailPayload = {
  accountId: string;
  externalId: string;
  adsets: MetaAdset[];
  ads: MetaAd[];
  adsetMetrics: MetaEntityDailyMetric[];
  adMetrics: MetaEntityDailyMetric[];
};

type FlatMetricRow = {
  entity_id: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
};
type FlatConvRow = {
  entity_id: string;
  date: string;
  action_type: string;
  count: number;
  value: number;
};

// Разворачивает суточные метрики/конверсии сущности в плоские строки; entity_id —
// наш uuid. Конкретное имя колонки (adset_id/ad_id) проставляется при upsert.
function flattenEntityMetrics(
  metrics: MetaEntityDailyMetric[],
  idByExternal: Map<string, string>,
): { metricRows: FlatMetricRow[]; convRows: FlatConvRow[] } {
  const metricRows: FlatMetricRow[] = [];
  const convRows: FlatConvRow[] = [];
  for (const row of metrics) {
    const entityId = idByExternal.get(row.entityExternalId);
    if (!entityId) continue;
    metricRows.push({
      entity_id: entityId,
      date: row.date,
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      reach: row.reach,
    });
    for (const conversion of row.conversions) {
      convRows.push({
        entity_id: entityId,
        date: row.date,
        action_type: conversion.actionType,
        count: conversion.count,
        value: conversion.value,
      });
    }
  }
  return { metricRows, convRows };
}

// Детальная загрузка: группы объявлений и объявления (level=adset/ad).
// Отдельная кнопка, потому что level=ad с time_increment=1 тяжёлый и мог бы
// повалить основную быструю синхронизацию по таймауту. Требует, чтобы кампании
// были уже загружены основным синком (adset/ad привязываются к ним по external_id).
export async function syncMetaAdDetails(
  _prevState: SyncMetaState,
  formData?: FormData,
): Promise<SyncMetaState> {
  const supabase = await createClient();
  const days = parseDays(formData);

  try {
    const { data: accounts, error: accErr } = await supabase
      .from("ad_accounts")
      .select("id,external_id,name")
      .eq("platform", "meta");
    if (accErr) throw new Error(accErr.message);
    const accountRows = (accounts ?? []) as {
      id: string;
      external_id: string;
      name: string | null;
    }[];
    if (accountRows.length === 0) {
      return {
        ok: false,
        message: "Сначала обновите основную статистику Меты (нет кабинетов).",
      };
    }

    const since = isoDaysAgo(days);
    const until = isoDaysAgo(0);

    // Тянем структуру и метрики по кабинетам параллельно (кабинеты независимы).
    const accountResults = await Promise.allSettled(
      accountRows.map(async (account) => {
        const [adsets, ads, adsetMetrics, adMetrics] = await Promise.all([
          fetchMetaAdsets(account.external_id),
          fetchMetaAds(account.external_id),
          fetchMetaAdsetInsights(account.external_id, since, until),
          fetchMetaAdInsights(account.external_id, since, until),
        ]);
        return {
          accountId: account.id,
          externalId: account.external_id,
          adsets,
          ads,
          adsetMetrics,
          adMetrics,
        };
      }),
    );
    const { payloads, failures } = partitionAccountResults<AdDetailPayload>(
      accountRows,
      accountResults,
    );
    if (payloads.length === 0) {
      return {
        ok: false,
        message:
          "Не удалось загрузить детали ни одного доступного кабинета Meta." +
          skippedAccountsSuffix(failures),
      };
    }

    let adsetCount = 0;
    let adCount = 0;
    let adsetDays = 0;
    let adDays = 0;
    let skippedNoParent = 0;

    for (const payload of payloads) {
      // Кампании кабинета: external_id → наш uuid (заведены основным синком).
      const { data: campaigns, error: cErr } = await supabase
        .from("ad_campaigns")
        .select("id,external_id")
        .eq("ad_account_id", payload.accountId);
      if (cErr) throw new Error(cErr.message);
      const campIdByExternal = new Map(
        (campaigns ?? []).map((c) => [c.external_id, c.id]),
      );

      // Группы объявлений. Пропускаем те, чья кампания не загружена.
      const adsetToUpsert = payload.adsets
        .map((adset) => {
          const campaignId = adset.campaignExternalId
            ? campIdByExternal.get(adset.campaignExternalId)
            : undefined;
          if (!campaignId) {
            skippedNoParent += 1;
            return null;
          }
          return {
            campaign_id: campaignId,
            external_id: adset.externalId,
            name: adset.name,
            status: adset.status,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      const adsetIdByExternal = new Map<string, string>();
      for (const batch of chunk(adsetToUpsert, 500)) {
        const { data, error } = await supabase
          .from("ad_sets")
          .upsert(batch, { onConflict: "campaign_id,external_id" })
          .select("id,external_id");
        if (error) throw new Error(error.message);
        for (const row of (data ?? []) as AdSetRowDb[]) {
          adsetIdByExternal.set(row.external_id, row.id);
        }
      }
      adsetCount += adsetIdByExternal.size;

      // Объявления. Пропускаем те, чья группа не загружена.
      const adToUpsert = payload.ads
        .map((ad) => {
          const adsetId = ad.adsetExternalId
            ? adsetIdByExternal.get(ad.adsetExternalId)
            : undefined;
          if (!adsetId) {
            skippedNoParent += 1;
            return null;
          }
          return {
            adset_id: adsetId,
            external_id: ad.externalId,
            name: ad.name,
            status: ad.status,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      const adIdByExternal = new Map<string, string>();
      for (const batch of chunk(adToUpsert, 500)) {
        const { data, error } = await supabase
          .from("ads")
          .upsert(batch, { onConflict: "adset_id,external_id" })
          .select("id,external_id");
        if (error) throw new Error(error.message);
        for (const row of (data ?? []) as AdRowDb[]) {
          adIdByExternal.set(row.external_id, row.id);
        }
      }
      adCount += adIdByExternal.size;

      // Суточные метрики и конверсии групп.
      const adsetFlat = flattenEntityMetrics(payload.adsetMetrics, adsetIdByExternal);
      for (const batch of chunk(adsetFlat.metricRows, 500)) {
        const { error } = await supabase.from("ad_set_metrics").upsert(
          batch.map(({ entity_id, ...rest }) => ({ adset_id: entity_id, ...rest })),
          { onConflict: "adset_id,date" },
        );
        if (error) throw new Error(error.message);
      }
      adsetDays += adsetFlat.metricRows.length;
      for (const batch of chunk(adsetFlat.convRows, 500)) {
        const { error } = await supabase.from("ad_set_conversions").upsert(
          batch.map(({ entity_id, ...rest }) => ({ adset_id: entity_id, ...rest })),
          { onConflict: "adset_id,date,action_type" },
        );
        if (error) throw new Error(error.message);
      }

      // Суточные метрики и конверсии объявлений.
      const adFlat = flattenEntityMetrics(payload.adMetrics, adIdByExternal);
      for (const batch of chunk(adFlat.metricRows, 500)) {
        const { error } = await supabase.from("ad_ad_metrics").upsert(
          batch.map(({ entity_id, ...rest }) => ({ ad_id: entity_id, ...rest })),
          { onConflict: "ad_id,date" },
        );
        if (error) throw new Error(error.message);
      }
      adDays += adFlat.metricRows.length;
      for (const batch of chunk(adFlat.convRows, 500)) {
        const { error } = await supabase.from("ad_ad_conversions").upsert(
          batch.map(({ entity_id, ...rest }) => ({ ad_id: entity_id, ...rest })),
          { onConflict: "ad_id,date,action_type" },
        );
        if (error) throw new Error(error.message);
      }
    }

    revalidatePath("/analytics");
    return {
      ok: true,
      message:
        `Детали за ${days} дн.: групп ${adsetCount}, объявлений ${adCount}, ` +
        `дней по группам ${adsetDays}, дней по объявлениям ${adDays}` +
        (skippedNoParent > 0
          ? `. Пропущено без родителя: ${skippedNoParent}.`
          : ".") +
        skippedAccountsSuffix(failures),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Ошибка детальной синхронизации Meta.",
    };
  }
}
