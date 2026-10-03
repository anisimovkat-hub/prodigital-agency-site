import type { ReactNode } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { SiGoogleads, SiMeta, SiTelegram, SiVk } from "react-icons/si";

import { AdPerformanceCharts } from "@/app/(dashboard)/analytics/meta/ad-performance-charts";
import { AdTreeTable, type AdTreeRow } from "@/app/(dashboard)/analytics/meta/ad-tree-table";
import { AdsFilters, type AdsFilterValues } from "@/app/(dashboard)/analytics/meta/ads-filters";
import { SyncMetaButton, SyncMetaDetailsButton } from "@/app/(dashboard)/analytics/meta/sync-button";
import type { Granularity, TimeseriesPoint } from "@/lib/ad-analytics";
import { summarizeAudienceGoal, type AudienceGoalRow } from "@/lib/audience-goal-performance";
import { formatCompact, type MarketingAudience, type MarketingAudienceItem } from "@/lib/marketing-analytics";
import {
  dailyAdDashboardPoints,
  percentChange,
  summarizeAdDashboard,
  type AdConversionDay,
  type AdMetricDay,
} from "@/lib/project-ad-dashboard";

type AccountOption = { id: string; name: string; project_id: string | null; platform: string; currency: string | null };
type CampaignOption = { id: string; name: string; project_id: string | null; account_id: string };

const integer = (value: number) => value.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
const money = (value: number, currency: string | null) =>
  `${value.toLocaleString("ru-RU", { maximumFractionDigits: value < 100 ? 2 : 0 })}${currency ? ` ${currency}` : ""}`;

function Delta({ value, lowerIsBetter = false, neutral = false, compact = false }: { value: number | null; lowerIsBetter?: boolean; neutral?: boolean; compact?: boolean }) {
  if (value === null) return <span className="text-xs text-neutral-400">Нет сопоставимого периода</span>;
  const improved = lowerIsBetter ? value < 0 : value > 0;
  const Icon = value < 0 ? ArrowDownRight : ArrowUpRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${neutral ? "text-neutral-600" : improved ? "text-emerald-700" : "text-rose-600"}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {Math.abs(value * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%
      {!compact && <span className="ml-1 font-normal text-neutral-400">к прошлому периоду</span>}
    </span>
  );
}

function Kpi({ label, value, delta, accent, lowerIsBetter = false, neutral = false, hint }: {
  label: string; value: string; delta: number | null; accent: string; lowerIsBetter?: boolean; neutral?: boolean; hint?: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 h-1 w-9 rounded-full ${accent}`} />
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">{label}</p>
      <p className="mt-2 truncate text-3xl font-semibold tabular-nums tracking-tight text-neutral-950" title={value}>{value}</p>
      <div className="mt-2 min-h-5">{hint ? <span className="text-xs text-neutral-400">{hint}</span> : <Delta value={delta} lowerIsBetter={lowerIsBetter} neutral={neutral} />}</div>
    </article>
  );
}

function PlatformMark({ platform }: { platform: string }) {
  if (platform === "meta") return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700" title="Meta"><SiMeta className="size-5" aria-hidden="true" /></span>
  );
  if (platform === "telegram_ads") return <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600" title="Telegram Ads"><SiTelegram className="size-5" aria-hidden="true" /></span>;
  if (platform === "vk") return <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700" title="VK Реклама"><SiVk className="size-5" aria-hidden="true" /></span>;
  if (platform === "yandex_direct") return <span className="flex size-8 items-center justify-center rounded-lg bg-red-50 text-base font-bold text-red-600" title="Яндекс Директ">Я</span>;
  if (platform === "google_ads") return <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600" title="Google Ads"><SiGoogleads className="size-5" aria-hidden="true" /></span>;
  return <span className="flex size-8 items-center justify-center rounded-lg bg-neutral-100 text-sm font-semibold text-neutral-600" aria-hidden="true">•</span>;
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return <span className="text-neutral-300">—</span>;
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => `${index * 82 / Math.max(1, values.length - 1)},${22 - value / max * 18}`).join(" ");
  return <svg viewBox="0 0 84 26" className="h-6 w-20" role="img" aria-label="Динамика результатов">
    <polyline fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={points} />
  </svg>;
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
  previousMetrics, previousConversions,
  audiencePerformanceRows,
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
}) {
  const goal = current.goal && goals.some((item) => item.value === current.goal)
    ? current.goal : goals.length === 1 ? goals[0].value : null;
  const goalLabel = goals.find((item) => item.value === goal)?.label ?? null;
  const selectedCampaigns = campaigns.filter((campaign) =>
    (!current.project || campaign.project_id === current.project) &&
    (!current.account || campaign.account_id === current.account) &&
    (!current.campaign || campaign.id === current.campaign),
  );
  const campaignIds = new Set(selectedCampaigns.map((campaign) => campaign.id));
  const selectedAccounts = accounts.filter((account) => !current.account || account.id === current.account);
  const usedAccountIds = new Set(selectedCampaigns.map((campaign) => campaign.account_id));
  const usedCurrencies = new Set(selectedAccounts.filter((account) => usedAccountIds.has(account.id)).map((account) => account.currency));
  const oneCurrency = usedCurrencies.size === 1 && !usedCurrencies.has(null);
  const currency = oneCurrency ? [...usedCurrencies][0] : null;
  const currentTotals = summarizeAdDashboard(metrics, conversions, campaignIds, goal, oneCurrency);
  const previousTotals = summarizeAdDashboard(previousMetrics, previousConversions, campaignIds, goal, oneCurrency);
  const points = dailyAdDashboardPoints(metrics, conversions, campaignIds, goal);
  const hasData = points.some((point) => point.spend > 0 || point.impressions > 0);

  return (
    <div className="space-y-5">
      <AdsFilters embedded projects={[]} accounts={accounts} campaigns={campaigns} goals={goals} current={{ ...current, goal: goal ?? "" }} />
      {freshnessWarning && <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{freshnessWarning}</p>}
      {currencies.length > 1 && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Выбраны кабинеты в разных валютах ({currencies.join(", ")}). Общие расход и цена цели скрыты; выберите кабинет.</p>}

      <section className="grid gap-3 md:grid-cols-3" aria-label="Ключевые показатели рекламы">
        <Kpi label={goalLabel ? `Цена: ${goalLabel}` : "Цена цели"} value={goal && oneCurrency && currentTotals.cpa !== null ? money(currentTotals.cpa, currency) : "—"}
          delta={goal && oneCurrency ? percentChange(currentTotals.cpa, previousTotals.cpa) : null} accent="bg-blue-600" lowerIsBetter hint={!goal ? "сначала выберите цель" : !oneCurrency ? "разные валюты" : undefined} />
        <Kpi label={goalLabel ?? "Целевые действия"} value={goal && currentTotals.conversions !== null ? integer(currentTotals.conversions) : "—"}
          delta={goal ? percentChange(currentTotals.conversions, previousTotals.conversions) : null} accent="bg-emerald-500" hint={!goal ? "сначала выберите цель" : undefined} />
        <Kpi label="Расход" value={oneCurrency ? money(currentTotals.spend, currency) : "—"}
          delta={oneCurrency ? percentChange(currentTotals.spend, previousTotals.spend) : null} accent="bg-violet-500" neutral hint={!oneCurrency ? "разные валюты" : undefined} />
      </section>

      <AdPerformanceCharts points={points} goalLabel={goalLabel} currency={currency} granularity={granularity} />

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-100 px-5 py-4">
          <h3 className="font-semibold text-neutral-950">Результаты по рекламным кабинетам</h3>
          <span className="text-xs text-neutral-400">Один проект · отдельные валюты и цели</span>
        </div>
        {!hasData ? <p className="p-5 text-sm text-neutral-500">За выбранный период нет рекламных данных. Проверьте подключение кабинетов или измените даты.</p> :
          <div className="divide-y divide-neutral-100">{selectedAccounts.map((account, index) => {
            const accountIds = new Set(selectedCampaigns.filter((campaign) => campaign.account_id === account.id).map((campaign) => campaign.id));
            const accountTotals = summarizeAdDashboard(metrics, conversions, accountIds, goal, !!account.currency);
            const previousAccount = summarizeAdDashboard(previousMetrics, previousConversions, accountIds, goal, !!account.currency);
            const accountDelta = percentChange(accountTotals.cpa, previousAccount.cpa);
            const accountPoints = dailyAdDashboardPoints(metrics, conversions, accountIds, goal);
            const accountRows = tree.filter((row) => accountIds.has(row.id));
            if (!accountRows.length && accountTotals.impressions === 0 && accountTotals.spend === 0) return null;
            return <details key={account.id} className="group" open={index === 0}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
                <PlatformMark platform={account.platform} />
                <span className="min-w-40 flex-1 text-sm font-semibold text-neutral-900">{account.name}</span>
                <span className="text-xs tabular-nums text-neutral-500">{goalLabel ?? "Результаты"}: <strong className="ml-1 text-sm text-neutral-900">{goal ? integer(accountTotals.conversions ?? 0) : "—"}</strong></span>
                <span className="min-w-28 text-right text-xs tabular-nums text-neutral-500">Расход <strong className="ml-1 text-sm text-neutral-900">{money(accountTotals.spend, account.currency)}</strong></span>
                <span className="min-w-28 text-right text-xs tabular-nums text-neutral-500">Цена <strong className="ml-1 text-sm text-neutral-900">{goal && accountTotals.cpa !== null ? money(accountTotals.cpa, account.currency) : "—"}</strong></span>
                <span className="min-w-12 text-right text-xs"><Delta value={accountDelta} lowerIsBetter compact /></span>
                <Sparkline values={accountPoints.map((point) => point.conversions)} />
                <span className="text-xs text-neutral-400 group-open:rotate-180" aria-hidden="true">⌄</span>
              </summary>
              <div className="overflow-x-auto border-t border-neutral-100 bg-neutral-50/40 px-5 py-3">
                <table className="w-full min-w-[580px] text-left text-sm">
                  <thead><tr className="text-xs text-neutral-500"><th className="pb-2 font-medium">Кампания</th><th className="pb-2 text-right font-medium">Клики</th><th className="pb-2 text-right font-medium">Результаты</th><th className="pb-2 text-right font-medium">Расход</th><th className="pb-2 text-right font-medium">Цена цели</th><th className="pb-2 text-right font-medium">Изменение</th><th className="pb-2 text-right font-medium">Динамика</th></tr></thead>
                  <tbody>{accountRows.map((row) => {
                    const result = summarizeAdDashboard(metrics, conversions, new Set([row.id]), goal, !!account.currency);
                    const previous = summarizeAdDashboard(previousMetrics, previousConversions, new Set([row.id]), goal, !!account.currency);
                    const series = dailyAdDashboardPoints(metrics, conversions, new Set([row.id]), goal);
                    return <tr key={row.id} className="border-t border-neutral-100"><td className="max-w-72 truncate py-2 pr-4 text-neutral-800" title={row.name}>{row.name}</td><td className="py-2 text-right tabular-nums text-neutral-600">{integer(result.clicks)}</td><td className="py-2 text-right tabular-nums font-medium text-neutral-900">{goal ? integer(result.conversions ?? 0) : "—"}</td><td className="py-2 text-right tabular-nums text-neutral-600">{money(result.spend, account.currency)}</td><td className="py-2 text-right tabular-nums font-medium text-neutral-900">{goal && result.cpa !== null ? money(result.cpa, account.currency) : "—"}</td><td className="py-2 text-right"><Delta value={percentChange(result.cpa, previous.cpa)} lowerIsBetter compact /></td><td className="py-2"><div className="flex justify-end"><Sparkline values={series.map((point) => point.conversions)} /></div></td></tr>;
                  })}</tbody>
                </table>
              </div>
            </details>;
          })}</div>}
      </section>

      {hasData && <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs tabular-nums text-neutral-500"><span>Показы <strong className="ml-1 text-neutral-800">{integer(currentTotals.impressions)}</strong></span><span>Клики <strong className="ml-1 text-neutral-800">{integer(currentTotals.clicks)}</strong></span><span>CTR <strong className="ml-1 text-neutral-800">{currentTotals.impressions ? `${(currentTotals.clicks / currentTotals.impressions * 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%` : "—"}</strong></span></div>}

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
