"use server";

import { revalidatePath } from "next/cache";

import {
  fetchMetaAdInsights,
  fetchMetaAds,
  fetchMetaAdsetInsights,
  fetchMetaAdsets,
  type MetaAd,
  type MetaAdset,
  type MetaEntityDailyMetric,
} from "@/lib/meta-ads";
import { syncMetaAdsData } from "@/lib/meta-sync";
import {
  formatAnalyticsPeriod,
  lastDaysPeriod,
  parseAnalyticsPeriod,
  type AnalyticsPeriod,
} from "@/lib/analytics-period";
import { createClient } from "@/lib/supabase/server";

export type SyncMetaState = { ok: boolean; message: string } | undefined;

const LOAD_PERIOD_DAYS = [7, 14, 30, 90, 180, 365];

function selectedProjectId(formData: FormData | undefined): string | undefined {
  const value = formData?.get("project_id");
  return typeof value === "string" && value ? value : undefined;
}

function selectedLoadPeriod(formData: FormData | undefined): AnalyticsPeriod | null {
  const days = Number(formData?.get("days"));
  if (LOAD_PERIOD_DAYS.includes(days)) return lastDaysPeriod(new Date(), days);
  return parseAnalyticsPeriod({
    from: formData?.get("from"),
    to: formData?.get("to"),
  });
}

// PostgREST не любит гигантские тела запроса — пишем пачками.
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

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
  const period = selectedLoadPeriod(formData);
  if (!period) {
    return { ok: false, message: "Выберите корректный период не длиннее 365 дней." };
  }
  const result = await syncMetaAdsData(supabase, period, selectedProjectId(formData));
  revalidatePath("/analytics");
  revalidatePath("/");
  return result;
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
  const period = selectedLoadPeriod(formData);
  if (!period) {
    return { ok: false, message: "Выберите корректный период не длиннее 365 дней." };
  }
  const projectId = selectedProjectId(formData);

  try {
    let accountsQuery = supabase
      .from("ad_accounts")
      .select("id,external_id,name")
      .eq("platform", "meta");
    if (projectId) accountsQuery = accountsQuery.eq("project_id", projectId);
    const { data: accounts, error: accErr } = await accountsQuery;
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

    const { from: since, to: until } = period;

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
        `Детали за ${formatAnalyticsPeriod(period)}: групп ${adsetCount}, объявлений ${adCount}, ` +
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
