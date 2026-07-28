import { AdTimeseriesChart } from "@/app/(dashboard)/ads/ad-timeseries-chart";
import { AdsFilters, type AdsFilterValues } from "@/app/(dashboard)/ads/ads-filters";
import { SyncMetaButton } from "@/app/(dashboard)/ads/sync-button";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const [{ data: accounts }, { data: campaigns }, { data: allProjects }] =
    await Promise.all([
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
    ]);

  const accountRows = (accounts ?? []) as AccountRow[];
  const campaignRows = (campaigns ?? []) as CampaignRow[];
  const accountById = new Map(accountRows.map((a) => [a.id, a]));

  // Проекты для фильтра — только те, где есть кампании.
  const projectsWithAds = new Set(
    campaignRows.map((c) => c.project_id).filter((id): id is string => !!id),
  );
  const projectOptions = (allProjects ?? []).filter((p) =>
    projectsWithAds.has(p.id),
  );

  // Период за срез: одна строка на кампанию + конверсии по всем целям.
  const { data: periodSummary } = await supabase.rpc(
    "ad_campaign_period_summary",
    { p_since: from, p_until: to },
  );

  // Цели для дропдауна — goal-типы, реально встретившиеся в периоде.
  const goalTypes = new Set<string>();
  for (const row of periodSummary ?? []) {
    for (const item of row.conversions ?? []) {
      if (isGoalAction(item.action_type)) goalTypes.add(item.action_type);
    }
  }
  const goalOptions = [...goalTypes]
    .map((value) => ({ value, label: actionTypeLabel(value) }))
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

  const goalLabel = goalFilter ? actionTypeLabel(goalFilter) : null;

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
  const campaignTable = filteredCampaigns
    .map((campaign) => ({
      campaign,
      account: accountById.get(campaign.ad_account_id) ?? null,
      stats: summaries.get(campaign.id) ?? null,
    }))
    .filter((row) => row.stats)
    .sort((a, b) => (b.stats?.spend ?? 0) - (a.stats?.spend ?? 0));

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
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <SyncMetaButton />
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
          Кампании за период
        </h2>
        <p className="text-sm text-neutral-500">
          «Главная цель» выбирается по данным самой кампании, CPA считается по ней.
          Под названием — все цели за период.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Кампания</TableHead>
              <TableHead>Проект</TableHead>
              <TableHead>Кабинет</TableHead>
              <TableHead>Расход</TableHead>
              <TableHead>Главная цель</TableHead>
              <TableHead>Конверсий</TableHead>
              <TableHead>CPA</TableHead>
              <TableHead>CTR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaignTable.length === 0 && (
              <TableEmpty colSpan={8}>
                Нет кампаний с данными за выбранный период и фильтры.
              </TableEmpty>
            )}
            {campaignTable.map(({ campaign, account, stats }) => (
              <TableRow key={campaign.id}>
                <TableCell className="max-w-xs">
                  <div className="font-medium text-neutral-900">
                    {campaign.name ?? "Без названия"}
                  </div>
                  {stats && stats.goals.length > 0 && (
                    <div className="text-xs text-neutral-500">
                      {stats.goals
                        .map(
                          (goal) =>
                            `${actionTypeLabel(goal.actionType)}: ${fmt(goal.count)}`,
                        )
                        .join(" · ")}
                    </div>
                  )}
                  {campaign.status && campaign.status !== "ACTIVE" && (
                    <div className="text-xs text-neutral-400">
                      статус: {campaign.status}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-neutral-600">
                  {campaign.project?.name ?? "— не привязана"}
                </TableCell>
                <TableCell className="text-neutral-500">
                  {account?.name ?? "—"}
                </TableCell>
                <TableCell>
                  {stats ? fmtMoney(stats.spend) : "—"}{" "}
                  <span className="text-xs text-neutral-400">
                    {account?.currency ?? ""}
                  </span>
                </TableCell>
                <TableCell className="text-neutral-600">
                  {stats?.primaryGoal
                    ? actionTypeLabel(stats.primaryGoal.actionType)
                    : "—"}
                </TableCell>
                <TableCell>
                  {stats?.primaryGoal ? fmt(stats.primaryGoal.count) : "—"}
                </TableCell>
                <TableCell>
                  {stats?.cpa === null || stats?.cpa === undefined
                    ? "—"
                    : fmtMoney(stats.cpa)}
                </TableCell>
                <TableCell className="text-neutral-500">
                  {fmtPercent(stats?.ctr ?? null)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
