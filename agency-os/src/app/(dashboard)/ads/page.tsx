import { AdTimeseriesChart } from "@/app/(dashboard)/ads/ad-timeseries-chart";
import { AdTreeTable, type AdTreeRow } from "@/app/(dashboard)/ads/ad-tree-table";
import { AdsFilters, type AdsFilterValues } from "@/app/(dashboard)/ads/ads-filters";
import {
  SyncMetaButton,
  SyncMetaDetailsButton,
} from "@/app/(dashboard)/ads/sync-button";
import {
  actionTypeLabel,
  defaultDateRange,
  isGoalAction,
  isGranularity,
  sumTimeseries,
  summarizeCampaigns,
  type ConversionRow,
  type Granularity,
  type TimeseriesPoint,
} from "@/lib/ad-analytics";
import { createClient } from "@/lib/supabase/server";

// Синхронизация с Meta ходит в Graph API по всем кабинетам — даём запас времени
// server action'ам этой страницы (см. route segment config maxDuration).
export const maxDuration = 60;

type AdsSearchParams = {
  from?: string;
  to?: string;
  gran?: string;
  project?: string;
  account?: string;
  campaign?: string;
  goal?: string;
};

type AccountRow = {
  id: string;
  name: string | null;
  external_id: string;
  currency: string | null;
  project_id: string | null;
  project: { name: string } | null;
};

type CampaignRow = {
  id: string;
  name: string | null;
  objective: string | null;
  status: string | null;
  ad_account_id: string;
  project_id: string | null;
  project: { name: string } | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fmt(value: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

function fmtMoney(value: number): string {
  return value.toLocaleString("ru-RU", {
    maximumFractionDigits: value < 100 ? 2 : 0,
  });
}

function fmtPercent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(2)}%`;
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-4">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <span className="text-xl font-semibold text-neutral-900">{value}</span>
      {hint && <span className="text-xs text-neutral-400">{hint}</span>}
    </div>
  );
}

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<AdsSearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .maybeSingle();

  if (profile?.role !== "owner") {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900">Реклама</h1>
        <p className="text-sm text-neutral-500">
          Раздел доступен только владельцу.
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const fallback = defaultDateRange(new Date(), 30);
  const from = params.from && ISO_DATE.test(params.from) ? params.from : fallback.since;
  const to = params.to && ISO_DATE.test(params.to) ? params.to : fallback.until;
  const granularity: Granularity = isGranularity(params.gran) ? params.gran : "day";
  const projectFilter = params.project ?? "";
  const accountFilter = params.account ?? "";
  const campaignFilter = params.campaign ?? "";
  const goalFilter = params.goal ?? "";

  const [
    { data: accounts },
    { data: campaigns },
    { data: allProjects },
    { data: customConversions },
    { data: adSetRows },
    { data: adRows },
  ] = await Promise.all([
    supabase
      .from("ad_accounts")
      .select("id,name,external_id,currency,project_id, project:projects(name)")
      .eq("platform", "meta")
      .order("name"),
    supabase
      .from("ad_campaigns")
      .select("id,name,objective,status,ad_account_id,project_id, project:projects(name)")
      .order("name"),
    supabase.from("projects").select("id,name").order("name"),
    supabase.from("ad_custom_conversions").select("conversion_id,name"),
    supabase.from("ad_sets").select("id,name,status,campaign_id"),
    supabase.from("ads").select("id,name,status,adset_id"),
  ]);

  const accountRows = (accounts ?? []) as AccountRow[];
  const campaignRows = (campaigns ?? []) as CampaignRow[];
  const accountById = new Map(accountRows.map((a) => [a.id, a]));

  // Справочник имён кастомных конверсий: conversion_id → имя (для actionTypeLabel).
  const customNames = new Map<string, string>();
  for (const row of customConversions ?? []) {
    if (row.name) customNames.set(row.conversion_id, row.name);
  }
  const label = (actionType: string) => actionTypeLabel(actionType, customNames);

  // Проекты для фильтра — только те, где есть кампании.
  const projectsWithAds = new Set(
    campaignRows.map((c) => c.project_id).filter((id): id is string => !!id),
  );
  const projectOptions = (allProjects ?? []).filter((p) =>
    projectsWithAds.has(p.id),
  );

  // Своды за период по трём уровням (кампании / группы / объявления) — параллельно.
  const [
    { data: periodSummary },
    { data: adsetSummary },
    { data: adSummary },
  ] = await Promise.all([
    supabase.rpc("ad_campaign_period_summary", { p_since: from, p_until: to }),
    supabase.rpc("ad_set_period_summary", { p_since: from, p_until: to }),
    supabase.rpc("ad_ad_period_summary", { p_since: from, p_until: to }),
  ]);

  // Цели для дропдауна — goal-типы, реально встретившиеся в периоде.
  const goalTypes = new Set<string>();
  for (const row of periodSummary ?? []) {
    for (const item of row.conversions ?? []) {
      if (isGoalAction(item.action_type)) goalTypes.add(item.action_type);
    }
  }
  const goalOptions = [...goalTypes]
    .map((value) => ({ value, label: label(value) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));

  // Временной ряд для графика и KPI (конверсии — по выбранной цели).
  const { data: series } = await supabase.rpc("ad_timeseries", {
    p_since: from,
    p_until: to,
    p_granularity: granularity,
    p_project_id: projectFilter || null,
    p_account_id: accountFilter || null,
    p_campaign_id: campaignFilter || null,
    p_action_type: goalFilter || null,
  });
  const points = (series ?? []) as TimeseriesPoint[];
  const totals = sumTimeseries(points);

  // Валюта среза: одна, если у релевантных кабинетов она совпадает; иначе смешанная.
  const relevantAccounts = campaignFilter
    ? accountRows.filter(
        (a) => a.id === campaignRows.find((c) => c.id === campaignFilter)?.ad_account_id,
      )
    : accountFilter
      ? accountRows.filter((a) => a.id === accountFilter)
      : projectFilter
        ? accountRows.filter((a) => a.project_id === projectFilter)
        : accountRows;
  const currencySet = new Set(
    relevantAccounts.map((a) => a.currency).filter((c): c is string => !!c),
  );
  const currency = currencySet.size === 1 ? [...currencySet][0] : null;
  const mixedCurrency = currencySet.size > 1;

  const goalLabel = goalFilter ? label(goalFilter) : null;

  // Таблица кампаний за период с учётом фильтров проект/кабинет/кампания.
  const filteredCampaigns = campaignRows.filter(
    (c) =>
      (!projectFilter || c.project_id === projectFilter) &&
      (!accountFilter || c.ad_account_id === accountFilter) &&
      (!campaignFilter || c.id === campaignFilter),
  );
  const allowedIds = new Set(filteredCampaigns.map((c) => c.id));
  const metricRows = (periodSummary ?? [])
    .filter((row) => allowedIds.has(row.campaign_id))
    .map((row) => ({
      campaign_id: row.campaign_id,
      spend: Number(row.spend ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
    }));
  const conversions: ConversionRow[] = [];
  for (const row of periodSummary ?? []) {
    if (!allowedIds.has(row.campaign_id)) continue;
    for (const item of row.conversions ?? []) {
      conversions.push({
        campaign_id: row.campaign_id,
        action_type: item.action_type,
        count: Number(item.count ?? 0),
        value: Number(item.value ?? 0),
      });
    }
  }
  const summaries = summarizeCampaigns(metricRows, conversions);

  // Своды по группам и объявлениям (та же функция; ключ = id сущности).
  const toSummaryInput = (
    rows: { id: string; spend: number; impressions: number; clicks: number }[],
    convSource: {
      id: string;
      conversions: { action_type: string; count: number; value: number }[];
    }[],
  ) => {
    const metrics = rows.map((r) => ({
      campaign_id: r.id,
      spend: r.spend,
      impressions: r.impressions,
      clicks: r.clicks,
    }));
    const convs: ConversionRow[] = [];
    for (const row of convSource) {
      for (const item of row.conversions ?? []) {
        convs.push({
          campaign_id: row.id,
          action_type: item.action_type,
          count: Number(item.count ?? 0),
          value: Number(item.value ?? 0),
        });
      }
    }
    return summarizeCampaigns(metrics, convs);
  };

  const adsetSummaries = toSummaryInput(
    (adsetSummary ?? []).map((r) => ({
      id: r.adset_id,
      spend: Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
    })),
    (adsetSummary ?? []).map((r) => ({ id: r.adset_id, conversions: r.conversions })),
  );
  const adSummaries = toSummaryInput(
    (adSummary ?? []).map((r) => ({
      id: r.ad_id,
      spend: Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
    })),
    (adSummary ?? []).map((r) => ({ id: r.ad_id, conversions: r.conversions })),
  );

  // Группировка сущностей для дерева.
  const adSetsByCampaign = new Map<string, typeof adSetRows>();
  for (const row of adSetRows ?? []) {
    const list = adSetsByCampaign.get(row.campaign_id) ?? [];
    list.push(row);
    adSetsByCampaign.set(row.campaign_id, list);
  }
  const adsByAdset = new Map<string, typeof adRows>();
  for (const row of adRows ?? []) {
    const list = adsByAdset.get(row.adset_id) ?? [];
    list.push(row);
    adsByAdset.set(row.adset_id, list);
  }

  const buildRow = (
    id: string,
    name: string | null,
    status: string | null,
    level: number,
    stats: NonNullable<ReturnType<typeof summaries.get>>,
    rowCurrency: string | null,
    children: AdTreeRow[],
  ): AdTreeRow => ({
    id,
    name: name ?? "Без названия",
    status,
    level,
    spend: stats.spend,
    impressions: stats.impressions,
    clicks: stats.clicks,
    ctr: stats.ctr,
    cpc: stats.cpc,
    cpm: stats.cpm,
    results: stats.primaryGoal ? stats.primaryGoal.count : null,
    goalLabel: stats.primaryGoal ? label(stats.primaryGoal.actionType) : null,
    cpa: stats.cpa,
    currency: rowCurrency,
    children,
  });

  const bySpendDesc = (a: AdTreeRow, b: AdTreeRow) => b.spend - a.spend;

  const tree: AdTreeRow[] = filteredCampaigns
    .map((campaign) => {
      const stats = summaries.get(campaign.id);
      if (!stats) return null;
      const rowCurrency =
        accountById.get(campaign.ad_account_id)?.currency ?? null;
      const adsets = (adSetsByCampaign.get(campaign.id) ?? [])
        .map((adset) => {
          const asStats = adsetSummaries.get(adset.id);
          if (!asStats) return null;
          const ads = (adsByAdset.get(adset.id) ?? [])
            .map((ad) => {
              const adStats = adSummaries.get(ad.id);
              if (!adStats) return null;
              return buildRow(ad.id, ad.name, ad.status, 2, adStats, rowCurrency, []);
            })
            .filter((r): r is AdTreeRow => r !== null)
            .sort(bySpendDesc);
          return buildRow(adset.id, adset.name, adset.status, 1, asStats, rowCurrency, ads);
        })
        .filter((r): r is AdTreeRow => r !== null)
        .sort(bySpendDesc);
      return buildRow(
        campaign.id,
        campaign.name,
        campaign.status,
        0,
        stats,
        rowCurrency,
        adsets,
      );
    })
    .filter((r): r is AdTreeRow => r !== null)
    .sort(bySpendDesc);

  // Есть ли вообще детализация (группы) в срезе — для подсказки.
  const hasDetails = tree.some((c) => c.children.length > 0);

  const current: AdsFilterValues = {
    from,
    to,
    gran: granularity,
    project: projectFilter,
    account: accountFilter,
    campaign: campaignFilter,
    goal: goalFilter,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Реклама (Meta)
          </h1>
          <p className="text-sm text-neutral-500">
            Аналитика по кабинетам, кампаниям и целям. Суммы — в валюте кабинета.
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3">
          <SyncMetaButton />
          <SyncMetaDetailsButton />
        </div>
      </div>

      <AdsFilters
        projects={projectOptions.map((p) => ({ id: p.id, name: p.name }))}
        accounts={accountRows.map((a) => ({
          id: a.id,
          name: a.name ?? a.external_id,
          project_id: a.project_id,
        }))}
        campaigns={campaignRows.map((c) => ({
          id: c.id,
          name: c.name ?? "Без названия",
          project_id: c.project_id,
          account_id: c.ad_account_id,
        }))}
        goals={goalOptions}
        current={current}
      />

      {mixedCurrency && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          В срез попали кабинеты с разными валютами ({[...currencySet].join(", ")})
          — суммарный расход смешивает валюты. Выберите проект или кабинет, чтобы
          видеть сопоставимые суммы (пересчёт в ₽ появится позже).
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Расход"
          value={fmtMoney(totals.spend)}
          hint={currency ?? (mixedCurrency ? "разные валюты" : undefined)}
        />
        <KpiCard label="Показы" value={fmt(totals.impressions)} />
        <KpiCard label="Клики" value={fmt(totals.clicks)} />
        <KpiCard label="CTR" value={fmtPercent(totals.ctr)} />
        <KpiCard
          label={goalLabel ?? "Конверсии"}
          value={goalLabel ? fmt(totals.conversions) : "—"}
          hint={goalLabel ? undefined : "выберите цель"}
        />
        <KpiCard
          label="CPA"
          value={goalLabel && totals.cpa !== null ? fmtMoney(totals.cpa) : "—"}
          hint={goalLabel ? (currency ?? undefined) : "по выбранной цели"}
        />
      </section>

      <AdTimeseriesChart
        points={points}
        granularity={granularity}
        currency={currency}
        goalLabel={goalLabel}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">
          Кампании → группы → объявления
        </h2>
        <p className="text-sm text-neutral-500">
          Разворачивайте строки, как в рекламном кабинете. «Результат» — главная цель
          строки, CPA считается по ней. Суммы — в валюте кабинета.
        </p>
        {!hasDetails && (
          <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            Детали по группам и объявлениям ещё не загружены. Нажмите «Загрузить
            детали (группы и объявления)» — после этого строки кампаний можно будет
            разворачивать.
          </p>
        )}
        {tree.length === 0 ? (
          <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            Нет кампаний с данными за выбранный период и фильтры.
          </p>
        ) : (
          <AdTreeTable rows={tree} />
        )}
      </section>
    </div>
  );
}
