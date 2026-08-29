"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, PlugZap, SearchX } from "lucide-react";

import { PortfolioAnalyticsControls } from "@/app/(dashboard)/analytics/analytics-controls";
import type { ProjectAnalyticsSummary } from "@/lib/project-analytics-summary";
import { formatCompact } from "@/lib/marketing-analytics";
import { cn } from "@/lib/utils";

type PortfolioFilter = "all" | "attention" | "new" | "normal" | "empty";

const BRAND_FALLBACKS = ["#2563eb", "#0ea5e9", "#0891b2", "#0f766e", "#059669", "#65a30d", "#d97706", "#ea580c", "#e11d48", "#7c3aed"];

function money(value: number | null, currency: string | null): string {
  if (value === null || !currency) return "—";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: value < 100 ? 2 : 0 }).format(value);
}

function fallbackColor(name: string): string {
  const hash = [...name].reduce((result, symbol) => (result * 31 + symbol.charCodeAt(0)) >>> 0, 0);
  return BRAND_FALLBACKS[hash % BRAND_FALLBACKS.length];
}

function daysSince(value: string | null): number | null {
  if (!value) return null;
  const start = new Date(`${value}T00:00:00Z`).getTime();
  const today = new Date();
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.floor((now - start) / 86_400_000);
  return days >= 0 ? days : null;
}

function priceDelta(row: ProjectAnalyticsSummary): number | null {
  return row.costPerLeadDeltaPercent ?? row.costPerGoalDeltaPercent;
}

function mainPrice(row: ProjectAnalyticsSummary): { label: string; value: number | null; delta: number | null } {
  if (row.costPerLead !== null) return { label: "Цена лида", value: row.costPerLead, delta: row.costPerLeadDeltaPercent };
  return { label: row.goalLabel ? `Цена: ${row.goalLabel}` : "Цена цели", value: row.costPerGoal, delta: row.costPerGoalDeltaPercent };
}

function rank(row: ProjectAnalyticsSummary): number {
  if (priceDelta(row) !== null && priceDelta(row)! > 15) return 0;
  const age = daysSince(row.startedAt);
  if (age !== null && age < 14) return 1;
  if (row.freshnessWarning) return 2;
  if (row.hasData) return 3;
  return 4;
}

function DeltaBadge({ label, value, tone }: { label: string; value: number; tone: "red" | "green" }) {
  const arrow = value > 0 ? "↑" : "↓";
  return <span className={cn("rounded-full px-2 py-1 text-[11px] font-semibold", tone === "red" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")}>{label} {arrow} {Math.abs(value).toFixed(0)}%</span>;
}

function matchesFilter(row: ProjectAnalyticsSummary, filter: PortfolioFilter): boolean {
  const increased = (priceDelta(row) ?? 0) > 15;
  const isNew = (daysSince(row.startedAt) ?? 99) < 14;
  if (filter === "attention") return increased || Boolean(row.freshnessWarning);
  if (filter === "new") return isNew;
  if (filter === "normal") return row.hasData && !increased && !isNew && !row.freshnessWarning;
  if (filter === "empty") return !row.hasData;
  return true;
}

function ProjectCard({ row }: { row: ProjectAnalyticsSummary }) {
  const price = mainPrice(row);
  const projectUrl = `/analytics?project=${encodeURIComponent(row.projectId)}&section=ads`;
  const age = daysSince(row.startedAt);
  const delta = price.delta;
  const isEmpty = !row.hasData;
  const color = row.brandColor ?? fallbackColor(row.projectName);

  return (
    <article className={cn("relative overflow-hidden rounded-xl border bg-white px-4 py-3", isEmpty ? "border-neutral-200 bg-neutral-50/70" : "border-neutral-200")}>
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} aria-hidden />
      <div className="ml-1 flex items-center justify-between gap-3">
        <Link href={projectUrl} className="min-w-0 truncate text-sm font-semibold text-neutral-950 hover:text-blue-700 hover:underline" title={row.projectName}>{row.projectName}</Link>
        <Link href={projectUrl} aria-label={`Открыть аналитику проекта «${row.projectName}»`} className="shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-blue-700"><ArrowUpRight className="size-4" /></Link>
      </div>

      {isEmpty ? (
        <div className="ml-1 mt-2 flex items-center justify-between gap-3 text-sm text-neutral-500">
          <span>{row.freshnessWarning ? "Кабинет не отвечает" : "Нет рекламных данных"}</span>
          <Link href={projectUrl} className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800 hover:border-neutral-400"><PlugZap className="size-3.5" />Подключить</Link>
        </div>
      ) : (
        <div className="ml-1 mt-2 flex flex-wrap items-end gap-x-5 gap-y-2">
          <div>
            <p className="text-[11px] font-medium text-neutral-500">{price.label}</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-neutral-950">{money(price.value, row.currency)}</p>
          </div>
          <Metric label="Расход" value={money(row.spend, row.currency)} hint={row.spendDeltaPercent === null ? undefined : `${row.spendDeltaPercent > 0 ? "+" : ""}${row.spendDeltaPercent.toFixed(0)}% к прошлому периоду`} />
          <Metric label="Результаты" value={formatCompact(row.conversions)} hint={row.goalLabel ?? undefined} />
        </div>
      )}

      <div className="ml-1 mt-2 flex flex-wrap gap-1.5">
        {delta !== null && delta > 15 && <DeltaBadge label={price.label} value={delta} tone="red" />}
        {delta !== null && delta < 0 && <DeltaBadge label={price.label} value={delta} tone="green" />}
        {age !== null && age < 14 && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Новый · {age} дн.</span>}
        {row.freshnessWarning && <span title={row.freshnessWarning} className="rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700">Кабинет не отвечает</span>}
        {row.hasMixedCurrencies && <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-600">Несколько валют</span>}
        {row.hasMultipleGoalTypes && <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-600">Разные цели</span>}
      </div>
    </article>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="min-w-20"><p className="text-[11px] font-medium text-neutral-500">{label}</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-neutral-900">{value}</p>{hint && <p className="max-w-32 truncate text-[10px] text-neutral-400" title={hint}>{hint}</p>}</div>;
}

export function ProjectAnalyticsOverview({ rows, from, to, projects }: { rows: ProjectAnalyticsSummary[]; from: string; to: string; projects: { id: string; name: string }[] }) {
  const [filter, setFilter] = useState<PortfolioFilter>("all");
  const [search, setSearch] = useState("");
  const visibleRows = useMemo(() => rows
    .filter((row) => row.projectName.toLocaleLowerCase("ru").includes(search.trim().toLocaleLowerCase("ru")))
    .filter((row) => matchesFilter(row, filter))
    .sort((left, right) => rank(left) - rank(right) || left.projectName.localeCompare(right.projectName, "ru")), [filter, rows, search]);
  const filters: { value: PortfolioFilter; label: string }[] = [
    { value: "all", label: "Все" }, { value: "attention", label: "Требуют внимания" },
    { value: "new", label: "Новые" }, { value: "normal", label: "В норме" }, { value: "empty", label: "Нет данных" },
  ];

  return <section className="space-y-4"><PortfolioAnalyticsControls from={from} to={to} projects={projects} search={search} onSearchChange={setSearch} /><div className="flex flex-wrap gap-2">{filters.map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition", filter === item.value ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400")}>{item.label}</button>)}</div><div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">{visibleRows.map((row) => <ProjectCard key={row.projectId} row={row} />)}</div>{visibleRows.length === 0 && <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-500"><SearchX className="mx-auto size-6 text-neutral-400" /><p className="mt-3 font-medium text-neutral-800">Ничего не найдено</p><p className="mt-1">Измените поиск или фильтр проектов.</p></div>}</section>;
}
