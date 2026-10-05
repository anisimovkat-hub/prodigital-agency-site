import type { ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Info } from "lucide-react";

import { AdPerformanceCharts } from "@/app/(dashboard)/analytics/meta/ad-performance-charts";
import { AdResultsTable, type AdAccountResult } from "@/app/(dashboard)/analytics/meta/ad-results-table";
import { AdTreeTable, type AdTreeRow } from "@/app/(dashboard)/analytics/meta/ad-tree-table";
import type { AdsFilterValues } from "@/app/(dashboard)/analytics/meta/ads-filters";
import { LinkMetaAccount } from "@/app/(dashboard)/analytics/meta/link-meta-account";
import { SyncMetaButton, SyncMetaDetailsButton } from "@/app/(dashboard)/analytics/meta/sync-button";
import type { Granularity, TimeseriesPoint } from "@/lib/ad-analytics";
import { selectDefaultAdGoal } from "@/lib/default-ad-goal";
import { summarizeAudienceGoal, type AudienceGoalRow } from "@/lib/audience-goal-performance";
import { formatCompact, type MarketingAudience, type MarketingAudienceItem } from "@/lib/marketing-analytics";
import {
  dailyAdDashboardPoints,
  aggregateAdDashboardPoints,
  fillAdDashboardDays,
  formatAdMoney,
  formatAdNumber,
  formatAdPercent,
  percentChange,
  summarizeAdDashboard,
  type AdConversionDay,
  type AdMetricDay,
} from "@/lib/project-ad-dashboard";

type AccountOption = { id: string; name: string; project_id: string | null; platform: string; currency: string | null };
type CampaignOption = { id: string; name: string; project_id: string | null; account_id: string };

const integer = (value: number) => formatAdNumber(value);
const money = (value: number, currency: string | null) => formatAdMoney(value, currency);
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const formatAdDate = (value: string) => { const [year, month, day] = value.split("-").map(Number); return `${day} ${MONTHS[month - 1]} ${year}`; };

function DeltaPill({ value, lowerIsBetter = false, neutral = false }: { value: number | null; lowerIsBetter?: boolean; neutral?: boolean }) {
  if (value === null) return <span className="text-xs text-neutral-400">нет данных за прошлый период</span>;
  const improved = lowerIsBetter ? value < 0 : value > 0;
  const Icon = value < 0 ? ArrowDown : ArrowUp;
  const tone = Math.abs(value) < 0.005 || neutral ? "bg-neutral-100 text-neutral-600" : improved ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600";
  return <span className="flex flex-wrap items-center gap-2">
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}><Icon className="size-3.5" aria-hidden="true" />{formatAdPercent(value)}</span>
    <span className="text-xs text-neutral-400">к предыдущему периоду</span>
  </span>;
}

function Kpi({ label, value, delta, lowerIsBetter = false, neutral = false, hint, info }: {
  label: string; value: string; delta: number | null; lowerIsBetter?: boolean; neutral?: boolean; hint?: string; info: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-neutral-700">{label}</p>
        <span title={info} className="cursor-help text-neutral-300 hover:text-neutral-500"><Info className="size-4" aria-label={info} /></span>
      </div>
      <p className="mt-2 truncate text-[32px] leading-tight font-bold tabular-nums tracking-tight text-neutral-950" title={value}>{value}</p>
      <div className="mt-2 min-h-6">{hint ? <span className="text-xs text-neutral-400">{hint}</span> : <DeltaPill value={delta} lowerIsBetter={lowerIsBetter} neutral={neutral} />}</div>
    </article>
  );
}

function AudienceBreakdown({ title, items }: { title: string; items: MarketingAudienceItem[] }) {
  const top = items.slice(0, 3);
  const max = Math.max(1, ...top.map((item) => item.impressions));
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-neutral-900">{title}</h4>
      {top.length ? <div className="mt-3 space-y-3">{top.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate text-neutral-700">{item.label}</span><span className="tabular-nums text-neutral-500">{formatCompact(item.impressions)} показов</span></div>
          <div className="h-1.5 rounded-full bg-neutral-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${item.impressions / max * 100}%` }} /></div>
        </div>
      ))}</div> : <p className="mt-3 text-xs text-neutral-500">Пока нет данных по срезу.</p>}
    </div>
  );
}

function GoalBreakdown({ title, items, fallback, currency }: {
  title: string;
  items: ReturnType<typeof summarizeAudienceGoal>;
  fallback: MarketingAudienceItem[];
  currency: string | null;
}) {
  const comparable = currency ? items.filter((item) => item.complete && item.results !== null && item.results >= 3 && item.cpa !== null).slice(0, 3) : [];
  if (!comparable.length) return <AudienceBreakdown title={title} items={fallback} />;
  const labelFor = (value: string) => {
    if (title === "Пол") return ({ male: "Мужчины", female: "Женщины", unknown: "Не указан" } as Record<string, string>)[value] ?? value;
    if (title === "Страны") {
      try { return new Intl.DisplayNames(["ru"], { type: "region" }).of(value.toUpperCase()) ?? value; }
      catch { return value; }
    }
    return value;
  };
  return <div className="rounded-xl border border-neutral-200 bg-white p-4">
    <h4 className="text-sm font-semibold text-neutral-900">{title}</h4>
    <p className="mt-1 text-[11px] text-neutral-500">Лучшая цена цели · от 3 результатов</p>
    <div className="mt-3 space-y-3">{comparable.map((item) => <div key={item.value} className="flex items-baseline justify-between gap-2 border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
      <span className="truncate text-xs font-medium text-neutral-700">{labelFor(item.value)}</span>
      <span className="shrink-0 text-right text-xs tabular-nums text-neutral-900"><strong>{money(item.cpa!, currency)}</strong><span className="ml-1 text-neutral-400">· {item.results} рез.</span></span>
    </div>)}</div>
  </div>;
}

export function AdAnalyticsPanel({
  current, accounts, campaigns, goals, granularity, currencies, tree, audience,
  audienceActions, hasMetaAccount, freshnessWarning, metrics, conversions,
  previousMetrics, previousConversions, unlinkedMetaAccounts = [],
  audiencePerformanceRows, latestDate = null,
}: {
  current: AdsFilterValues;
  accounts: AccountOption[];
  campaigns: CampaignOption[];
  goals: { value: string; label: string }[];
  points: TimeseriesPoint[];
  granularity: Granularity;
  currency: string | null;
  currencies: string[];
  goalLabel: string | null;
  tree: AdTreeRow[];
  audience: MarketingAudience;
  audienceActions?: ReactNode;
  hasMetaAccount: boolean;
  freshnessWarning?: string | null;
  metrics: AdMetricDay[];
  conversions: AdConversionDay[];
  previousMetrics: AdMetricDay[];
  previousConversions: AdConversionDay[];
  audiencePerformanceRows: AudienceGoalRow[];
  unlinkedMetaAccounts?: { id: string; name: string }[];
  latestDate?: string | null;
}) {
  const selectedCampaigns = campaigns.filter((campaign) =>
    (!current.project || campaign.project_id === current.project) &&
    (!current.account || campaign.account_id === current.account) &&
    (!current.campaign || campaign.id === current.campaign),
  );
  const campaignIds = new Set(selectedCampaigns.map((campaign) => campaign.id));
  const goal = selectDefaultAdGoal(current.goal, goals, conversions, campaignIds);
  const goalLabel = goals.find((item) => item.value === goal)?.label ?? null;
  const selectedAccounts = accounts.filter((account) => !current.account || account.id === current.account);
  const usedAccountIds = new Set(selectedCampaigns.map((campaign) => campaign.account_id));
  const usedCurrencies = new Set(selectedAccounts.filter((account) => usedAccountIds.has(account.id)).map((account) => account.currency));
  const oneCurrency = usedCurrencies.size === 1 && !usedCurrencies.has(null);
  const currency = oneCurrency ? [...usedCurrencies][0] : null;
  const currentTotals = summarizeAdDashboard(metrics, conversions, campaignIds, goal, oneCurrency);
  const previousTotals = summarizeAdDashboard(previousMetrics, previousConversions, campaignIds, goal, oneCurrency);
  const points = aggregateAdDashboardPoints(fillAdDashboardDays(dailyAdDashboardPoints(metrics, conversions, campaignIds, goal), current.from, current.to), granularity);
  const hasData = points.some((point) => point.spend > 0 || point.impressions > 0);
  const goalRows = goals.map((option) => ({
    ...option,
    total: summarizeAdDashboard(metrics, conversions, campaignIds, option.value, oneCurrency),
  })).filter((option) => (option.total.conversions ?? 0) > 0);
  const accountResults: AdAccountResult[] = selectedAccounts.map((account) => {
    const accountIds = new Set(selectedCampaigns.filter((campaign) => campaign.account_id === account.id).map((campaign) => campaign.id));
    const totals = summarizeAdDashboard(metrics, conversions, accountIds, goal, !!account.currency);
    const previous = summarizeAdDashboard(previousMetrics, previousConversions, accountIds, goal, !!account.currency);
    const campaignResults = selectedCampaigns.filter((campaign) => accountIds.has(campaign.id)).map((campaign) => {
      const ids = new Set([campaign.id]);
      const total = summarizeAdDashboard(metrics, conversions, ids, goal, !!account.currency);
      const before = summarizeAdDashboard(previousMetrics, previousConversions, ids, goal, !!account.currency);
      return { id: campaign.id, name: campaign.name, ...total, delta: percentChange(total.cpa, before.cpa), trend: fillAdDashboardDays(dailyAdDashboardPoints(metrics, conversions, ids, goal), current.from, current.to) };
    }).filter((campaign) => campaign.spend > 0 || campaign.impressions > 0 || (campaign.conversions ?? 0) > 0).sort((a, b) => b.spend - a.spend);
    return { ...account, ...totals, delta: percentChange(totals.cpa, previous.cpa), trend: fillAdDashboardDays(dailyAdDashboardPoints(metrics, conversions, accountIds, goal), current.from, current.to), campaigns: campaignResults };
  }).filter((account) => account.campaigns.length > 0);

  return (
    <div className="space-y-3">
      {!selectedAccounts.length && current.project && <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
        <div><h3 className="text-sm font-semibold text-neutral-950">Рекламный кабинет ещё не подключён</h3><p className="mt-1 text-xs leading-relaxed text-neutral-600">Проверьте кабинеты Meta, затем привяжите нужный к этому проекту. Данные других проектов не будут смешаны.</p></div>
        <SyncMetaButton period={{ from: current.from, to: current.to }} projectId={current.project} label="Найти кабинеты Meta" />
        <LinkMetaAccount projectId={current.project} accounts={unlinkedMetaAccounts} />
      </section>}
      {freshnessWarning && <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />{freshnessWarning}</p>}
      {currencies.length > 1 && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Выбраны кабинеты в разных валютах ({currencies.join(", ")}). Общие расход и цена цели скрыты; выберите кабинет.</p>}

      <section className="grid gap-3 md:grid-cols-3" aria-label="Ключевые показатели рекламы">
        <Kpi label="Цена результата" value={goal && oneCurrency && currentTotals.cpa !== null ? money(currentTotals.cpa, currency) : "—"}
          delta={goal && oneCurrency ? percentChange(currentTotals.cpa, previousTotals.cpa) : null} lowerIsBetter
          hint={!goal ? "сначала выберите цель" : !oneCurrency ? "кабинеты в разных валютах" : undefined}
          info={`Расход, делённый на число результатов${goalLabel ? ` «${goalLabel}»` : ""} за период`} />
        <Kpi label={goalLabel ? `Результаты · ${goalLabel}` : "Результаты"} value={goal && currentTotals.conversions !== null ? integer(currentTotals.conversions) : "—"}
          delta={goal ? percentChange(currentTotals.conversions, previousTotals.conversions) : null}
          hint={!goal ? "сначала выберите цель" : undefined}
          info="Количество выбранных целевых действий по данным рекламных кабинетов" />
        <Kpi label="Расход" value={oneCurrency ? money(currentTotals.spend, currency) : "—"}
          delta={oneCurrency ? percentChange(currentTotals.spend, previousTotals.spend) : null} neutral
          hint={!oneCurrency ? "кабинеты в разных валютах" : undefined}
          info="Сумма расхода по выбранным кабинетам без НДС, как её отдаёт рекламная система" />
      </section>

      <AdPerformanceCharts points={points} goalLabel={goalLabel} currency={currency} granularity={granularity} />

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4 pb-2">
          <h3 className="text-[15px] font-semibold text-neutral-950">Где получены результаты</h3>
          {goalLabel && <span className="text-xs text-neutral-400">Цель: {goalLabel}</span>}
        </div>
        {!hasData ? <p className="px-5 pb-5 text-sm text-neutral-500">За выбранный период нет рекламных данных. Проверьте подключение кабинетов или измените даты.</p> : <AdResultsTable accounts={accountResults} />}
      </section>

      {(hasData || latestDate) && <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-1 text-xs tabular-nums text-neutral-400">
        {hasData ? <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span>Показы <strong className="ml-1 font-semibold text-neutral-800">{integer(currentTotals.impressions)}</strong></span>
          <span>Клики <strong className="ml-1 font-semibold text-neutral-800">{integer(currentTotals.clicks)}</strong></span>
          <span>CTR <strong className="ml-1 font-semibold text-neutral-800">{currentTotals.impressions ? `${formatAdNumber(currentTotals.clicks / currentTotals.impressions * 100, 2)}%` : "—"}</strong></span>
        </span> : <span />}
        {latestDate && <span>Последние данные в кабинетах: {formatAdDate(latestDate)}</span>}
      </div>}

      {goalRows.length > 1 && <details className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900">Все цели и конверсии · {goalRows.length}</summary>
        <p className="mt-2 text-xs text-neutral-500">Каждая цель показана отдельно: Meta может учитывать одно действие сразу в нескольких типах конверсий, поэтому числа не складываются.</p>
        <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr className="border-b border-neutral-100 text-xs text-neutral-500"><th className="py-2 font-medium">Цель</th><th className="py-2 text-right font-medium">Конверсии</th><th className="py-2 text-right font-medium">Цена</th></tr></thead><tbody>{goalRows.map((row) => <tr key={row.value} className="border-b border-neutral-100 last:border-0"><td className="py-2 text-neutral-800">{row.label}</td><td className="py-2 text-right tabular-nums">{integer(row.total.conversions ?? 0)}</td><td className="py-2 text-right tabular-nums">{row.total.cpa !== null ? money(row.total.cpa, currency) : "—"}</td></tr>)}</tbody></table></div>
      </details>}


      {hasMetaAccount && <section className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-neutral-950">Аудитория и география</h3><p className="mt-1 max-w-3xl text-xs leading-relaxed text-neutral-500">Если Meta передала расход и конверсии по выбранной цели, срезы отсортированы по цене результата. Иначе показано только распределение показов — по нему нельзя судить о конверсии. Срезы разных валют не объединяются.</p></div>{audienceActions}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <GoalBreakdown title="Страны" items={summarizeAudienceGoal(audiencePerformanceRows, "country", goal)} fallback={audience.country} currency={currency} />
          <GoalBreakdown title="Возраст" items={summarizeAudienceGoal(audiencePerformanceRows, "age", goal)} fallback={audience.age} currency={currency} />
          <GoalBreakdown title="Пол" items={summarizeAudienceGoal(audiencePerformanceRows, "gender", goal)} fallback={audience.gender} currency={currency} />
        </div>
      </section>}

      {tree.length > 0 && <details className="rounded-2xl border border-neutral-200 bg-white"><summary className="cursor-pointer px-5 py-4 text-sm font-medium text-neutral-700">Детализация: кампании → группы → объявления · исходные цели кампаний</summary><div className="overflow-x-auto border-t border-neutral-100"><AdTreeTable rows={tree} /></div></details>}
      {hasMetaAccount && <details className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-neutral-700">Обновить данные Meta вручную</summary>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
          <SyncMetaButton period={{ from: current.from, to: current.to }} projectId={current.project} />
          <SyncMetaDetailsButton period={{ from: current.from, to: current.to }} projectId={current.project} />
        </div>
      </details>}
    </div>
  );
}
