import { AdTimeseriesChart } from "@/app/(dashboard)/analytics/meta/ad-timeseries-chart";
import { AdTreeTable, type AdTreeRow } from "@/app/(dashboard)/analytics/meta/ad-tree-table";
import { AdsFilters, type AdsFilterValues } from "@/app/(dashboard)/analytics/meta/ads-filters";
import { SyncMetaButton, SyncMetaDetailsButton } from "@/app/(dashboard)/analytics/meta/sync-button";
import { sumTimeseries, type Granularity, type TimeseriesPoint } from "@/lib/ad-analytics";

type Option = { id: string; name: string };
type AccountOption = Option & { project_id: string | null };
type CampaignOption = Option & { project_id: string | null; account_id: string };

function formatNumber(value: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

function formatMoney(value: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: value < 100 ? 2 : 0 });
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(2)}%`;
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-4">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <span className="text-xl font-semibold text-neutral-900">{value}</span>
      {hint && <span className="text-xs text-neutral-400">{hint}</span>}
    </div>
  );
}

export function AdAnalyticsPanel({
  current,
  accounts,
  campaigns,
  goals,
  points,
  granularity,
  currency,
  currencies,
  goalLabel,
  tree,
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
}) {
  const totals = sumTimeseries(points);
  const mixedCurrency = currencies.length > 1;
  const hasDetails = tree.some((campaign) => campaign.children.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <div>
          <h2 className="font-semibold text-neutral-950">Реклама Meta</h2>
          <p className="mt-1 text-xs text-neutral-500">Кабинеты, кампании, цели, группы и объявления в одном срезе</p>
        </div>
        <div className="flex flex-col gap-2">
          <SyncMetaButton />
          <SyncMetaDetailsButton />
        </div>
      </div>

      <AdsFilters
        embedded
        projects={[]}
        accounts={accounts}
        campaigns={campaigns}
        goals={goals}
        current={current}
      />

      {mixedCurrency && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          В срез попали кабинеты с разными валютами ({currencies.join(", ")}). Выберите проект или кабинет, чтобы суммы были сопоставимы.
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Расход" value={formatMoney(totals.spend)} hint={currency ?? (mixedCurrency ? "разные валюты" : undefined)} />
        <KpiCard label="Показы" value={formatNumber(totals.impressions)} />
        <KpiCard label="Клики" value={formatNumber(totals.clicks)} />
        <KpiCard label="CTR" value={formatPercent(totals.ctr)} />
        <KpiCard label={goalLabel ?? "Конверсии"} value={goalLabel ? formatNumber(totals.conversions) : "—"} hint={goalLabel ? undefined : "выберите цель"} />
        <KpiCard label="CPA" value={goalLabel && totals.cpa !== null ? formatMoney(totals.cpa) : "—"} hint={goalLabel ? (currency ?? undefined) : "по выбранной цели"} />
      </section>

      <AdTimeseriesChart points={points} granularity={granularity} currency={currency} goalLabel={goalLabel} />

      <section className="flex flex-col gap-2 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="font-semibold text-neutral-900">Кампании → группы → объявления</h2>
          <p className="mt-1 text-xs text-neutral-500">Разворачивайте строки, чтобы перейти от кампании к группе и конкретному объявлению.</p>
        </div>
        {!hasDetails && tree.length > 0 && (
          <p className="mx-4 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            Детали ещё не загружены. Нажмите «Загрузить детали», чтобы раскрывать кампании до групп и объявлений.
          </p>
        )}
        {tree.length === 0 ? (
          <p className="m-4 rounded-md bg-neutral-50 px-3 py-4 text-sm text-neutral-500">Нет рекламных данных за выбранный период и фильтры.</p>
        ) : (
          <div className="overflow-x-auto"><AdTreeTable rows={tree} /></div>
        )}
      </section>
    </div>
  );
}
