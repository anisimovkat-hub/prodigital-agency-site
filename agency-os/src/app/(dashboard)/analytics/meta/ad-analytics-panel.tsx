import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Layers3, MapPin, UsersRound } from "lucide-react";

import { AdTimeseriesChart } from "@/app/(dashboard)/analytics/meta/ad-timeseries-chart";
import { AdTreeTable, type AdTreeRow } from "@/app/(dashboard)/analytics/meta/ad-tree-table";
import { AdsFilters, type AdsFilterValues } from "@/app/(dashboard)/analytics/meta/ads-filters";
import { SyncMetaButton, SyncMetaDetailsButton } from "@/app/(dashboard)/analytics/meta/sync-button";
import { sumTimeseries, type Granularity, type TimeseriesPoint } from "@/lib/ad-analytics";
import { formatCompact, type MarketingAudience, type MarketingAudienceItem } from "@/lib/marketing-analytics";
import { cn } from "@/lib/utils";

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

function AudienceMiniCard({
  title,
  rows,
  color,
  icon: Icon,
}: {
  title: string;
  rows: MarketingAudienceItem[];
  color: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  const visible = rows.slice(0, 5);
  const max = Math.max(1, ...visible.map((row) => row.impressions));
  const total = rows.reduce((sum, row) => sum + row.impressions, 0);
  return (
    <article className="flex min-h-44 flex-col rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-neutral-500" aria-hidden={true} />
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        </div>
        {total > 0 && <span className="text-[11px] text-neutral-400">{formatCompact(total)} показов</span>}
      </div>
      {visible.length ? (
        <div className="mt-3 space-y-2.5">
          {visible.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate font-medium text-neutral-700">{row.label}</span>
                <span className="shrink-0 tabular-nums text-neutral-400">{formatCompact(row.impressions)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(2, row.impressions / max * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="my-auto text-center text-xs leading-relaxed text-neutral-400">Данные появятся после обновления аудитории Meta</p>
      )}
    </article>
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
  audience,
  audienceActions,
  freshnessWarning,
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
  freshnessWarning?: string | null;
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

      {freshnessWarning && (
        <div
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{freshnessWarning}</p>
        </div>
      )}

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

      {audienceActions}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdTimeseriesChart points={points} granularity={granularity} currency={currency} goalLabel={goalLabel} compact />
        <AudienceMiniCard title="Возраст" rows={audience.age} color="bg-violet-500" icon={UsersRound} />
        <AudienceMiniCard title="Пол" rows={audience.gender} color="bg-fuchsia-500" icon={UsersRound} />
        <AudienceMiniCard title="Страны" rows={audience.country} color="bg-emerald-500" icon={MapPin} />
      </section>

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

      {(audience.region.length > 0 || audience.placement.length > 0) && (
        <details className="rounded-xl border border-neutral-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-900">Дополнительные срезы: регионы и площадки</summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <AudienceMiniCard title="Регионы" rows={audience.region} color="bg-cyan-500" icon={MapPin} />
            <AudienceMiniCard title="Площадки показов" rows={audience.placement} color="bg-blue-600" icon={Layers3} />
          </div>
        </details>
      )}
    </div>
  );
}
