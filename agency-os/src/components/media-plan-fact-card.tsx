import { CircleAlert, Gauge, TrendingDown, TrendingUp } from "lucide-react";

import type { MediaPlanFactRow } from "@/lib/media-plan-fact";
import { cn } from "@/lib/utils";

export type MediaPlanSummary = {
  id: string;
  name: string;
  workstream: string | null;
  period_start: string;
  period_end: string;
  currency: string;
};

export function MediaPlanFactCard({
  plan,
  rows,
  compact = false,
}: {
  plan: MediaPlanSummary;
  rows: MediaPlanFactRow[];
  compact?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/50">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className="rounded-lg bg-blue-100 p-2 text-blue-700"><Gauge className="h-4 w-4" aria-hidden="true" /></span>
          <div>
            <h2 className="text-sm font-semibold text-neutral-950">План / факт · {plan.name}</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {formatDate(plan.period_start)}–{formatDate(plan.period_end)}
              {plan.workstream ? ` · ${plan.workstream}` : ""} · {plan.currency}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">Утверждён</span>
      </div>
      <div className={cn("grid gap-px bg-blue-100", compact ? "md:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2")}>
        {rows.map((row) => {
          const percent = row.completion === null ? null : Math.round(row.completion * 100);
          const over = row.variance > 0;
          const isCost = row.metric_key === "spend";
          const favorable = isCost ? !over : over;
          return (
            <article key={row.id} className="bg-white/95 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-xs font-medium text-neutral-600" title={row.label}>{row.label}</p>
                {percent !== null && (
                  <span className={cn("flex items-center gap-1 text-xs font-semibold", favorable ? "text-emerald-700" : "text-amber-700")}>
                    {over ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {percent}%
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-3 tabular-nums">
                <p className="text-lg font-semibold text-neutral-950">{formatValue(row.factValue, row.unit, plan.currency)}</p>
                <p className="text-xs text-neutral-400">план {formatValue(row.target_value, row.unit, plan.currency)}</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100" aria-label={percent === null ? "Нулевой план" : `Выполнено ${percent}%`}>
                <div className={cn("h-full rounded-full", favorable ? "bg-emerald-500" : "bg-blue-500")} style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }} />
              </div>
              {row.currencyMismatch && <p className="mt-2 flex items-center gap-1 text-[11px] text-red-600"><CircleAlert className="h-3 w-3" />Кампания в другой валюте не учтена</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatValue(value: number, unit: MediaPlanFactRow["unit"], currency: string): string {
  if (unit === "money") {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: value < 100 ? 2 : 0 }).format(value);
  }
  if (unit === "percent") return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value)}%`;
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
}
