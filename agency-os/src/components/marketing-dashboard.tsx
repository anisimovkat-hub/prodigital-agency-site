import type { ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, Layers3, MapPin, Target, UsersRound } from "lucide-react";
import { ProjectLogo } from "@/components/project-logo";
import { MarketingContentReport } from "@/components/marketing-content-report";
import { formatCompact, formatMetricPercent, type MarketingAdDetail, type MarketingAudienceItem, type MarketingPayload } from "@/lib/marketing-analytics";
import type { MarketingSection } from "@/lib/marketing-sections";
import { cn } from "@/lib/utils";

export type { MarketingSection } from "@/lib/marketing-sections";

type MarketingDashboardProps = {
  payload: MarketingPayload;
  section: MarketingSection;
  publicReport?: boolean;
  controls?: ReactNode;
  filters?: ReactNode;
  contentActions?: ReactNode;
  adsPanel?: ReactNode;
  audienceActions?: ReactNode;
  mediaPlan?: ReactNode;
};

function money(value: number, currency: string | null): string {
  if (!currency) return "Несколько валют";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: value < 100 ? 2 : 0 }).format(value);
}

function CampaignGoals({ payload }: { payload: MarketingPayload }) {
  if (!payload.paid.campaigns.length) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-5 py-3"><h2 className="font-semibold text-neutral-950">Результаты по целям кампаний</h2><p className="mt-0.5 text-xs text-neutral-500">Каждая цель показана отдельно: подписки, регистрации, лиды, сообщения и другие конверсии не смешиваются.</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-medium text-neutral-500"><tr><th className="px-5 py-3">Кампания</th><th className="px-4 py-3">Цель кампании</th><th className="px-4 py-3 text-right">Расход</th><th className="px-4 py-3">Полученные результаты</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {payload.paid.campaigns.map((campaign) => <tr key={campaign.id}><td className="max-w-[300px] px-5 py-3"><p className="truncate font-medium text-neutral-950" title={campaign.name}>{campaign.name}</p><p className="mt-0.5 text-xs text-neutral-400">{campaign.objective || "Цель не указана"}</p></td><td className="px-4 py-3 text-neutral-600">{campaign.goals.length ? campaign.goals.map((goal) => goal.label).join(", ") : "Нет измеримой цели"}</td><td className="px-4 py-3 text-right tabular-nums">{campaign.currency ? money(campaign.spend, campaign.currency) : formatCompact(campaign.spend)}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2">{campaign.goals.length ? campaign.goals.map((goal) => <span key={goal.actionType} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-800"><strong>{formatCompact(goal.count)}</strong> {goal.label}{goal.cpa !== null && campaign.currency ? ` · ${money(goal.cpa, campaign.currency)}` : ""}</span>) : <span className="text-xs text-neutral-400">Проверьте цель и отслеживание кампании</span>}</div></td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdDetailTable({ title, subtitle, rows }: { title: string; subtitle: string; rows: MarketingAdDetail[] }) {
  if (!rows.length) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-5 py-4"><h3 className="font-semibold text-neutral-950">{title}</h3><p className="mt-1 text-xs text-neutral-500">{subtitle}</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-medium text-neutral-500"><tr><th className="px-5 py-3">Название</th><th className="px-4 py-3">Родитель</th><th className="px-4 py-3 text-right">Расход</th><th className="px-4 py-3 text-right">Показы</th><th className="px-4 py-3 text-right">Клики</th><th className="px-4 py-3 text-right">CTR</th><th className="px-4 py-3 text-right">Результат</th><th className="px-4 py-3 text-right">CPA</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.slice(0, 10).map((row) => <tr key={row.id}><td className="max-w-[280px] px-5 py-3"><p className="truncate font-medium text-neutral-950" title={row.name}>{row.name}</p></td><td className="max-w-[240px] px-4 py-3"><p className="truncate text-neutral-500" title={row.parentName}>{row.parentName}</p></td><td className="px-4 py-3 text-right tabular-nums">{row.currency ? money(row.spend, row.currency) : formatCompact(row.spend)}</td><td className="px-4 py-3 text-right tabular-nums">{formatCompact(row.impressions)}</td><td className="px-4 py-3 text-right tabular-nums">{formatCompact(row.clicks)}</td><td className="px-4 py-3 text-right tabular-nums">{formatMetricPercent(row.ctr)}</td><td className="px-4 py-3 text-right"><span className="font-medium text-neutral-900">{row.results === null ? "—" : formatCompact(row.results)}</span>{row.resultLabel && <span className="ml-1 text-xs text-neutral-400">{row.resultLabel}</span>}</td><td className="px-4 py-3 text-right tabular-nums">{row.cpa === null ? "—" : row.currency ? money(row.cpa, row.currency) : formatCompact(row.cpa)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AudienceBars({ rows, color = "bg-blue-600" }: { rows: MarketingAudienceItem[]; color?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.impressions));
  return <div className="mt-4 space-y-3">{rows.slice(0, 8).map((row) => <div key={row.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-neutral-700">{row.label}</span><span className="shrink-0 tabular-nums text-neutral-500">{formatCompact(row.impressions)}</span></div><div className="h-2 overflow-hidden rounded-full bg-neutral-100"><div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(2, (row.impressions / max) * 100)}%` }} /></div></div>)}</div>;
}

function AudienceDashboard({ payload }: { payload: MarketingPayload }) {
  const audience = payload.paid.audience;
  const hasData = Object.values(audience).some((rows) => rows.length > 0);
  if (!hasData) {
    return <section className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center"><Target className="mx-auto h-7 w-7 text-blue-600" /><h2 className="mt-3 font-semibold text-neutral-900">Срезы аудитории ещё не загружены</h2><p className="mt-1 text-sm text-neutral-500">Нажмите «Обновить аудиторию Meta» — появятся возраст, пол, страны, регионы и площадки показов.</p></section>;
  }
  return (
    <section>
      <div className="mb-3"><h2 className="font-semibold text-neutral-950">Аудитория и география рекламы</h2><p className="mt-1 text-xs text-neutral-500">Распределение показов Meta за выбранный период</p></div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-neutral-500" /><h3 className="font-semibold text-neutral-900">Возраст</h3></div><AudienceBars rows={audience.age} color="bg-blue-500" /></article>
        <article className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-neutral-500" /><h3 className="font-semibold text-neutral-900">Пол</h3></div><AudienceBars rows={audience.gender} color="bg-blue-500" /></article>
        <article className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-neutral-500" /><h3 className="font-semibold text-neutral-900">Страны</h3></div><AudienceBars rows={audience.country} color="bg-blue-500" /></article>
        <article className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-neutral-500" /><h3 className="font-semibold text-neutral-900">Регионы</h3></div><AudienceBars rows={audience.region} color="bg-blue-500" /></article>
        <article className="rounded-2xl border border-neutral-200 bg-white p-5 lg:col-span-2 xl:col-span-2"><div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-blue-600" /><h3 className="font-semibold text-neutral-900">Площадки показов</h3></div><AudienceBars rows={audience.placement} color="bg-blue-600" /></article>
      </div>
    </section>
  );
}

function AudienceSection({
  payload,
  actions,
  hideWhenEmpty = false,
}: {
  payload: MarketingPayload;
  actions?: ReactNode;
  hideWhenEmpty?: boolean;
}) {
  const hasData = Object.values(payload.paid.audience).some((rows) => rows.length > 0);
  if (hideWhenEmpty && !hasData) return null;
  return (
    <div className="space-y-3 border-t border-neutral-200 pt-4">
      {actions}
      <AudienceDashboard payload={payload} />
    </div>
  );
}


function ProjectMark({ payload, publicReport }: { payload: MarketingPayload; publicReport: boolean }) {
  return <div className="flex min-w-0 items-center gap-3">
    {payload.project.id && <ProjectLogo projectId={payload.project.id} name={payload.project.name} logoUrl={payload.project.logoUrl} size="lg" />}
    <div className="min-w-0">
      <p className="mb-0.5 text-xs text-neutral-400">{publicReport ? "Клиентский отчёт" : <><Link href="/analytics" className="hover:text-neutral-700 hover:underline">Все проекты</Link> / {payload.project.name}</>}</p>
      <h1 className="truncate text-xl font-bold tracking-tight text-neutral-950 sm:text-[26px]"><span className="hidden sm:inline">Аналитика / </span>{payload.project.name}</h1>
    </div>
  </div>;
}

/** Public reports use their existing scoped RPC payload, never owner-only queries. */
function PaidReportFallback({ payload, audienceActions, publicReport }: { payload: MarketingPayload; audienceActions?: ReactNode; publicReport: boolean }) {
  const currency = payload.paid.currencies.length === 1 ? payload.paid.currencies[0] : null;
  const hasData = payload.daily.some((day) => day.paidReach > 0 || day.spend > 0) || payload.paid.campaigns.length > 0;
  return <div className="space-y-3">
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Ключевые показатели рекламы">
      {[
        ["Расход", hasData && currency ? money(payload.paid.spend, currency) : "—"],
        ["Показы", hasData ? formatCompact(payload.paid.impressions) : "—"],
        ["Клики", hasData ? formatCompact(payload.paid.clicks) : "—"],
      ].map(([label, value]) => <article key={label} className="min-w-0 rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"><p className="text-sm text-neutral-700">{label}</p><p className="mt-2 text-[32px] font-bold tracking-tight text-neutral-950 tabular-nums">{value}</p><p className="mt-2 text-xs text-neutral-400">{label === "Расход" && !currency && payload.paid.currencies.length > 1 ? "Суммы разных валют показаны отдельно ниже" : "За выбранный период"}</p></article>)}
    </section>
    {!hasData && <p className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-500">За выбранный период нет рекламных данных.</p>}
    <CampaignGoals payload={payload} />
    <AdDetailTable title="Группы объявлений" subtitle="Исходные цели и валюта каждой группы" rows={payload.paid.adSets} />
    <AdDetailTable title="Объявления" subtitle="Результаты каждого объявления отдельно" rows={payload.paid.ads} />
    <AudienceSection payload={payload} actions={audienceActions} hideWhenEmpty={publicReport} />
  </div>;
}

export function MarketingDashboard({
  payload, section, publicReport = false, controls, filters, contentActions, adsPanel, audienceActions, mediaPlan,
}: MarketingDashboardProps) {
  const paidReport = adsPanel ?? <PaidReportFallback payload={payload} audienceActions={audienceActions} publicReport={publicReport} />;
  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3"><ProjectMark payload={payload} publicReport={publicReport} />{controls}</header>
      {filters}
      {publicReport && <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800"><BadgeCheck className="size-4" />Актуальный клиентский отчёт · данные доступны только для этого проекта</div>}
      {section === "overview" && <>
        {paidReport}
        <MarketingContentReport payload={payload} compact />
        {mediaPlan && <details className="rounded-2xl border border-neutral-200 bg-white px-4 py-3"><summary className="cursor-pointer text-sm font-medium text-neutral-700">Планы и фактические результаты</summary><div className="mt-3">{mediaPlan}</div></details>}
      </>}
      {section === "content" && <><MarketingContentReport payload={payload} />{contentActions}</>}
      {section === "ads" && paidReport}
    </div>
  );
}
