import { ArrowUpRight, ReceiptText, Target } from "lucide-react";

import type { ProjectAnalyticsSummary } from "@/lib/project-analytics-summary";
import { formatCompact } from "@/lib/marketing-analytics";

function money(value: number | null, currency: string | null): string {
  if (value === null || !currency) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency", currency, maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

function Value({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="min-w-0 rounded-lg bg-neutral-50 px-3 py-2.5"><p className="text-[11px] font-medium text-neutral-500">{label}</p><p className="mt-1 truncate text-sm font-semibold tabular-nums text-neutral-950">{value}</p>{hint && <p className="mt-0.5 truncate text-[11px] text-neutral-400">{hint}</p>}</div>;
}

export function ProjectAnalyticsOverview({ rows, from, to }: { rows: ProjectAnalyticsSummary[]; from: string; to: string }) {
  const period = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });
  const periodLabel = `${period.format(new Date(`${from}T00:00:00Z`))} — ${period.format(new Date(`${to}T00:00:00Z`))}`;
  return <section className="space-y-4"><div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950"><p className="font-semibold">Сводка по проектам</p><p className="mt-0.5 text-xs text-blue-800">{periodLabel}. Каждый проект рассчитан отдельно: суммы разных валют и целей не объединяются.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => {
    const costHint = row.hasMultipleGoalTypes ? "В проекте разные цели" : row.goalLabel ?? "Цель не получена";
    const moneyUnavailable = row.hasMixedCurrencies ? "Несколько валют" : undefined;
    return <a key={row.projectId} href={`/analytics?project=${encodeURIComponent(row.projectId)}&section=ads`} className="group rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold text-neutral-950" title={row.projectName}>{row.projectName}</h2><p className="mt-1 text-xs text-neutral-500">{row.hasData ? "Реклама Meta за период" : "Рекламных данных за период нет"}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-400 transition group-hover:text-blue-600" /></div>{row.hasData ? <div className="mt-4 grid grid-cols-2 gap-2"><Value label="Расход" value={money(row.spend, row.currency)} hint={moneyUnavailable} /><Value label="Показы" value={formatCompact(row.impressions)} /><Value label="Клики" value={formatCompact(row.clicks)} /><Value label="Результаты" value={formatCompact(row.conversions)} hint={costHint} /><Value label="Цена лида" value={money(row.costPerLead, row.currency)} hint={row.costPerLead === null ? moneyUnavailable ?? "Лидов нет" : "Только лидовые кампании"} /><Value label="Цена цели" value={money(row.costPerGoal, row.currency)} hint={row.costPerGoal === null ? moneyUnavailable ?? costHint : row.goalLabel ?? undefined} /></div> : <div className="mt-4 flex min-h-32 items-center gap-3 rounded-lg bg-neutral-50 px-4 text-sm text-neutral-500"><ReceiptText className="h-5 w-5 shrink-0 text-neutral-400" />После синхронизации Meta здесь появятся расход, показы, клики и стоимость результата.</div>}<span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">Открыть подробную аналитику <ArrowUpRight className="h-3.5 w-3.5" /></span></a>;
  })}</div>{rows.length === 0 && <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-500"><Target className="mx-auto h-6 w-6 text-neutral-400" /><p className="mt-3 font-medium text-neutral-800">Нет активных проектов для сводки</p><p className="mt-1">Добавьте проект или выберите его в фильтре выше.</p></div>}</section>;
}
