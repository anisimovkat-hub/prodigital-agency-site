import type { ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Info } from "lucide-react";

import { AdPerformanceCharts } from "@/app/(dashboard)/analytics/meta/ad-performance-charts";
import { AdResultsTable, type AdAccountResult } from "@/app/(dashboard)/analytics/meta/ad-results-table";
import { AdTreeTable, type AdTreeRow } from "@/app/(dashboard)/analytics/meta/ad-tree-table";
import { ReportCurrencySwitch, type AdsFilterValues } from "@/app/(dashboard)/analytics/meta/ads-filters";
import { DashboardMetricGrid } from "@/app/(dashboard)/analytics/meta/dashboard-metric-grid";
import { LinkMetaAccount } from "@/app/(dashboard)/analytics/meta/link-meta-account";
import { SyncMetaButton, SyncMetaDetailsButton } from "@/app/(dashboard)/analytics/meta/sync-button";
import type { Granularity } from "@/lib/ad-analytics";
import type { AdSourceStatus } from "@/lib/ad-data-freshness";
import { goalLabel, goalsWithData, type CampaignGoal, type GoalKey } from "@/lib/ad-goals";
import { buildDashboardMetrics, mandatoryMetricIds } from "@/lib/ad-dashboard-metrics";
import type { FxRate } from "@/lib/fx-rates";
import { prepareReportCurrency, type ReportCurrency } from "@/lib/ad-report-currency";
import { buildGoalCards, goalDailyPoints, type GoalCard, type GoalSetting, type ScopedYandexGoal } from "@/lib/project-ad-goals";
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
  if (value === null) return <span className="text-xs text-neutral-400">нет сравнения</span>;
  const improved = lowerIsBetter ? value < 0 : value > 0;
  const Icon = value < 0 ? ArrowDown : ArrowUp;
  const tone = Math.abs(value) < 0.005 || neutral ? "bg-neutral-100 text-neutral-600" : improved ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600";
  return <span className="flex flex-wrap items-center gap-2">
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}><Icon className="size-3.5" aria-hidden="true" />{formatAdPercent(value)}</span>
    <span className="hidden text-xs text-neutral-400 sm:inline">к предыдущему периоду</span>
  </span>;
}

/** On phones the first (main) card spans the row; the other two sit side by side. */
function Kpi({ label, detail, value, delta, lowerIsBetter = false, neutral = false, hint, info, main = false, footnote, action }: {
  label: string; detail?: string | null; value: string; delta: number | null; lowerIsBetter?: boolean; neutral?: boolean; hint?: string; info: string; main?: boolean;
  footnote?: string; action?: ReactNode;
}) {
  return (
    <article className={`min-w-0 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:px-5 md:py-4 ${main ? "col-span-2 md:col-span-1" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-neutral-600 md:text-sm md:text-neutral-700" title={detail ? `${label} · ${detail}` : label}>{label}{detail && <span className="hidden md:inline"> · {detail}</span>}</p>
        <span className="flex shrink-0 items-center gap-2">{action}<span title={info} className="hidden cursor-help text-neutral-300 hover:text-neutral-500 md:inline"><Info className="size-4" aria-label={info} /></span></span>
      </div>
      {/* The main card puts its change next to the value on phones instead of leaving the right half empty. */}
      <div className={main ? "flex items-end justify-between gap-3 md:block" : ""}>
        <p className={`mt-1 truncate leading-tight font-bold tabular-nums tracking-tight text-neutral-950 md:mt-2 md:text-[32px] ${main ? "text-[28px]" : "text-xl"}`} title={value}>{value}</p>
        <div className={`min-h-6 md:mt-2 ${main ? "shrink-0 pb-1 md:pb-0" : "mt-1.5"}`}>{hint ? <span className="text-xs text-neutral-400">{hint}</span> : <DeltaPill value={delta} lowerIsBetter={lowerIsBetter} neutral={neutral} />}</div>
      </div>
      {footnote && <p className="mt-1 truncate text-[11px] text-neutral-500 md:text-xs" title={footnote}>{footnote}</p>}
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

/** Audience slices come in account currency, so a price is shown only for a single currency. */
function singleNative(accounts: AccountOption[]): string | null {
  const set = new Set(accounts.map((account) => account.currency));
  return set.size === 1 ? [...set][0] : null;
}

export function AdAnalyticsPanel({
  current, accounts, campaigns, campaignGoals, goalSettings, customNames, fxRates, displayCurrency, userId, yandexGoals = [],
  granularity, tree, audience, audienceActions, hasMetaAccount, sourceStatus, metrics, conversions,
  previousMetrics, previousConversions, unlinkedMetaAccounts = [], audiencePerformanceRows, latestDate = null, goalSettingsForm,
}: {
  current: AdsFilterValues;
  accounts: AccountOption[];
  campaigns: CampaignOption[];
  campaignGoals: Map<string, CampaignGoal>;
  goalSettings: GoalSetting[];
  yandexGoals?: ScopedYandexGoal[];
  customNames?: Map<string, string>;
  fxRates: FxRate[];
  displayCurrency: ReportCurrency;
  userId: string;
  granularity: Granularity;
  tree: AdTreeRow[];
  audience: MarketingAudience;
  audienceActions?: ReactNode;
  hasMetaAccount: boolean;
  sourceStatus?: AdSourceStatus;
  metrics: AdMetricDay[];
  conversions: AdConversionDay[];
  previousMetrics: AdMetricDay[];
  previousConversions: AdConversionDay[];
  audiencePerformanceRows: AudienceGoalRow[];
  unlinkedMetaAccounts?: { id: string; name: string }[];
  latestDate?: string | null;
  goalSettingsForm?: ReactNode;
}) {
  const selectedCampaigns = campaigns.filter((campaign) =>
    (!current.project || campaign.project_id === current.project) &&
    (!current.account || campaign.account_id === current.account) &&
    (!current.campaign || campaign.id === current.campaign),
  );
  const campaignIds = new Set(selectedCampaigns.map((campaign) => campaign.id));
  const selectedAccounts = accounts.filter((account) =>
    (!current.project || account.project_id === current.project) &&
    (!current.account || account.id === current.account) &&
    (!current.campaign || selectedCampaigns.some((campaign) => campaign.account_id === account.id)),
  );
  const accountCurrency = new Map(accounts.map((account) => [account.id, account.currency]));
  const campaignCurrency = new Map(campaigns.map((campaign) => [campaign.id, accountCurrency.get(campaign.account_id) ?? null]));

  const display = prepareReportCurrency({
    mode: displayCurrency, rates: fxRates,
    metrics: metrics.filter((row) => campaignIds.has(row.campaign_id)),
    previousMetrics: previousMetrics.filter((row) => campaignIds.has(row.campaign_id)),
    campaignCurrencies: campaignCurrency, fallbackCurrencies: selectedAccounts.map((account) => account.currency),
  });
  const currency = display.current.currency;
  const summaryMetrics = display.current.metrics;
  const summaryPrevious = display.previous.metrics;

  const cardArgs = { selected: campaignIds, goals: campaignGoals, metrics: summaryMetrics, conversions, previousMetrics: summaryPrevious, previousConversions, customNames, yandexGoals };
  const withCurrency = (card: GoalCard): GoalCard => ({
    ...card,
    current: { ...card.current, cpa: currency ? card.current.cpa : null },
    previous: { ...card.previous, cpa: display.previous.currency ? card.previous.cpa : null },
  });
  const cards = buildGoalCards({ ...cardArgs, settings: goalSettings }).map(withCurrency);
  const observedGoals = goalsWithData([...conversions, ...previousConversions].filter((row) => campaignIds.has(row.campaign_id)).map((row) => row.action_type));
  const optionalSettings: GoalSetting[] = observedGoals.filter((key) => !goalSettings.some((item) => item.goal_key === key))
    .map((key) => ({ goal_key: key, label: null, hidden: false, extra: true }));
  const availableCards = buildGoalCards({ ...cardArgs, settings: [...goalSettings, ...optionalSettings], includeInactive: true }).map(withCurrency);
  const selectedCard = availableCards.find((card) => card.key === current.goal) ?? cards.find((card) => !card.extra && !card.key.startsWith('yandex:')) ?? null;
  const spendNow = summaryMetrics.reduce((sum, row) => sum + Number(row.spend), 0);
  const spendBefore = summaryPrevious.reduce((sum, row) => sum + Number(row.spend), 0);
  const noGoalSpend = summaryMetrics.filter((row) => !campaignGoals.get(row.campaign_id)).reduce((sum, row) => sum + Number(row.spend), 0);
  const totals = summarizeAdDashboard(metrics, conversions, campaignIds, null, false);
  const previousTotals = summarizeAdDashboard(previousMetrics, previousConversions, campaignIds, null, false);
  const points = selectedCard && selectedCard.current.complete !== false
    ? aggregateAdDashboardPoints(fillAdDashboardDays(goalDailyPoints(summaryMetrics.length ? summaryMetrics : metrics, conversions, selectedCard, campaignGoals), current.from, current.to), granularity)
    : [];
  const hasData = summaryMetrics.length > 0 || conversions.some((row) => campaignIds.has(row.campaign_id));
  const defaultGoals = new Set(cards.filter((card) => !card.key.startsWith('yandex:')).map((card) => card.key));
  if (selectedCard) defaultGoals.add(selectedCard.key);
  const orderedCards = selectedCard ? [selectedCard, ...availableCards.filter((card) => card.key !== selectedCard.key)] : availableCards;
  const dashboardMetrics = buildDashboardMetrics({
    cards: orderedCards, defaultGoals, hasData, currency, previousCurrency: display.previous.currency,
    spend: spendNow, previousSpend: spendBefore, impressions: totals.impressions,
    previousImpressions: previousTotals.impressions, clicks: totals.clicks, previousClicks: previousTotals.clicks,
  });
  const labelOf = (key: GoalKey) => goalSettings.find((item) => item.goal_key === key)?.label || goalLabel(key, customNames);

  // Table: native account currency; each campaign is measured by its own goal.
  const accountResults: AdAccountResult[] = selectedAccounts.map((account) => {
    const accountCampaigns = selectedCampaigns.filter((campaign) => campaign.account_id === account.id);
    const campaignResults = accountCampaigns.map((campaign) => {
      const goal = campaignGoals.get(campaign.id) ?? null;
      const ids = new Set([campaign.id]);
      const total = summarizeAdDashboard(metrics, conversions, ids, goal?.action ?? null, !!account.currency);
      const before = summarizeAdDashboard(previousMetrics, previousConversions, ids, goal?.action ?? null, !!account.currency);
      return { id: campaign.id, name: campaign.name, goalKey: goal?.key ?? null, goalLabel: goal ? labelOf(goal.key) : account.platform === 'yandex_direct' ? "Цель не выбрана" : "Без целевого действия", ...total, delta: percentChange(total.cpa, before.cpa), trend: total.conversions !== null ? fillAdDashboardDays(dailyAdDashboardPoints(metrics, conversions, ids, goal?.action ?? null), current.from, current.to) : [] };
    }).filter((campaign) => campaign.spend > 0 || campaign.impressions > 0 || (campaign.conversions ?? 0) > 0);
    const keys = new Set(campaignResults.map((campaign) => campaign.goalKey));
    const single = keys.size === 1 && !keys.has(null);
    const spend = campaignResults.reduce((sum, campaign) => sum + campaign.spend, 0);
    const results = single && campaignResults.every((c) => c.conversions !== null) ? campaignResults.reduce((sum, campaign) => sum + campaign.conversions!, 0) : null;
    const previousSpend = summarizeAdDashboard(previousMetrics, previousConversions, new Set(accountCampaigns.map((campaign) => campaign.id)), null, false).spend;
    const previousCounts = accountCampaigns.map((campaign) => {
      const goal = campaignGoals.get(campaign.id);
      return goal ? summarizeAdDashboard(previousMetrics, previousConversions, new Set([campaign.id]), goal.action, false).conversions : null;
    });
    const previousResults = single && previousCounts.every((count) => count !== null) ? previousCounts.reduce<number>((sum, count) => sum + count!, 0) : null;
    const cpa = single && results ? spend / results : null;
    const previousCpa = single && previousResults ? previousSpend / previousResults : null;
    const trendByDay = new Map<string, number>();
    for (const campaign of campaignResults) for (const point of campaign.trend) trendByDay.set(point.bucket, (trendByDay.get(point.bucket) ?? 0) + (single ? point.conversions : 0));
    return {
      ...account, spend, impressions: 0, clicks: 0, conversions: results, cpa, delta: percentChange(cpa, previousCpa),
      goalLabel: single ? campaignResults[0].goalLabel : keys.size > 1 ? "разные цели" : null,
      trend: [...trendByDay].map(([bucket, conversions]) => ({ bucket, conversions })).sort((x, y) => x.bucket.localeCompare(y.bucket)),
      campaigns: campaignResults.sort((x, y) => y.spend - x.spend),
    };
  }).filter((account) => account.campaigns.length > 0);
  const audienceAction = selectedCard && !selectedCard.extra ? [...selectedCard.campaignIds].map((id) => campaignGoals.get(id)?.action).find(Boolean) ?? null : null;

  return (
    <div className="space-y-3">
      {!selectedAccounts.length && current.project && <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
        <div><h3 className="text-sm font-semibold text-neutral-950">Рекламный кабинет ещё не подключён</h3><p className="mt-1 text-xs leading-relaxed text-neutral-600">Кабинеты Яндекса, ВК и Telegram подключаются на странице проекта. Для Meta проверьте кабинеты и привяжите нужный.</p></div>
        <SyncMetaButton period={{ from: current.from, to: current.to }} projectId={current.project} label="Найти кабинеты Meta" />
        <LinkMetaAccount projectId={current.project} accounts={unlinkedMetaAccounts} />
      </section>}
      {sourceStatus?.message && <p className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${sourceStatus.state === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-neutral-200 bg-neutral-50 text-neutral-600"}`}>{sourceStatus.state === "error" ? <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" /> : <Info className="size-3.5 shrink-0" aria-hidden="true" />}{sourceStatus.message}</p>}
      {!currency && hasData && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{display.mixedNative ? "У кабинетов разные валюты: суммы показаны раздельно. Для общей цены цели выберите USD или RUB, либо один кабинет." : `Валюта кабинета или курс на дату расхода недоступны — денежная сводка${displayCurrency === "native" ? "" : ` в ${displayCurrency}`} не рассчитана.`} Таблица ниже сохраняет исходные суммы.</p>}
      {currency && !display.previous.currency && hasData && <p className="px-1 text-xs text-neutral-500">Нет полного курса за предыдущий период — сравнение денежных показателей недоступно.</p>}
      {yandexGoals.length > 0 && !selectedCard && <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">Выберите конкретную цель Яндекса выше. Общая сумма всех целей больше не выдаётся за количество заявок. Основную цель можно сохранить в «Цели проекта».</p>}
      {selectedCard?.current.complete === false && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Статистика выбранной цели за этот период не загружена полностью. Обновите кабинеты на странице проекта; пропуски не считаются нулевыми конверсиями.</p>}

      <DashboardMetricGrid key={`${userId}:${current.project}`} userId={userId} projectId={current.project}
        required={mandatoryMetricIds(selectedCard?.key ?? null)}
        options={dashboardMetrics.map((metric) => ({ ...metric, content: <Kpi main={metric.id === "spend"}
          label={metric.label}
          value={metric.id === "spend" && display.mixedNative ? "Разные валюты" : metric.value === null ? "—" : metric.format === "money" ? money(metric.value, currency) : metric.format === "percent" ? `${formatAdNumber(metric.value, 2)}%` : integer(metric.value)}
          delta={metric.delta} lowerIsBetter={metric.lowerIsBetter} neutral={metric.neutral}
          footnote={metric.id === "spend" ? display.mixedNative ? display.nativeSpend.map((item) => item.currency ? money(item.spend, item.currency) : `${integer(item.spend)} · валюта не указана`).join(" · ") : currency && noGoalSpend > 0 ? `из них ${money(noGoalSpend, currency)} — ${selectedAccounts.some((a) => a.platform === 'yandex_direct') ? 'цель не выбрана' : 'без целевого действия'}` : undefined : metric.note}
          action={metric.id === "spend" ? <ReportCurrencySwitch currency={displayCurrency} nativeCurrency={display.nativeCurrency} /> : undefined}
          info={metric.info} /> }))} />

      <AdPerformanceCharts points={points} goalLabel={selectedCard?.label ?? null} currency={selectedCard && !selectedCard.extra ? currency : null} granularity={granularity} priceNote={selectedCard?.extra ? "У дополнительной цели нет отдельной цены" : undefined} />

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3 pb-2 md:px-5 md:pt-4">
          <h3 className="text-[15px] font-semibold text-neutral-950">Где получены результаты</h3>
          <span className="text-xs text-neutral-400">{current.goal.startsWith('yandex:') ? 'Выбранная цель Яндекса · последний переход · целевые визиты' : 'Каждая кампания — по своей цели'} · суммы в валюте кабинета</span>
        </div>
        {!hasData ? <p className="px-5 pb-5 text-sm text-neutral-500">За выбранный период нет рекламных данных.</p> : <AdResultsTable accounts={accountResults} />}
      </section>

      {(hasData || latestDate) && <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-1 text-xs tabular-nums text-neutral-400">
        {hasData ? <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span>Показы <strong className="ml-1 font-semibold text-neutral-800">{integer(totals.impressions)}</strong></span>
          <span>Клики <strong className="ml-1 font-semibold text-neutral-800">{integer(totals.clicks)}</strong></span>
          <span>CTR <strong className="ml-1 font-semibold text-neutral-800">{totals.impressions ? `${formatAdNumber(totals.clicks / totals.impressions * 100, 2)}%` : "—"}</strong></span>
        </span> : <span />}
        {latestDate && <span>Последние данные в кабинетах: {formatAdDate(latestDate)}</span>}
      </div>}

      {goalSettingsForm}

      {hasMetaAccount && <section className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-neutral-950">Аудитория и география</h3><p className="mt-1 max-w-3xl text-xs leading-relaxed text-neutral-500">Если Meta передала расход и конверсии по выбранной цели, срезы отсортированы по цене результата. Иначе показано только распределение показов — по нему нельзя судить о конверсии. Срезы разных валют не объединяются.</p></div>{audienceActions}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <GoalBreakdown title="Страны" items={summarizeAudienceGoal(audiencePerformanceRows, "country", audienceAction)} fallback={audience.country} currency={singleNative(selectedAccounts)} />
          <GoalBreakdown title="Возраст" items={summarizeAudienceGoal(audiencePerformanceRows, "age", audienceAction)} fallback={audience.age} currency={singleNative(selectedAccounts)} />
          <GoalBreakdown title="Пол" items={summarizeAudienceGoal(audiencePerformanceRows, "gender", audienceAction)} fallback={audience.gender} currency={singleNative(selectedAccounts)} />
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
