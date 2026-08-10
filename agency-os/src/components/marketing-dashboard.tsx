import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  CircleAlert,
  Layers3,
  Lightbulb,
  MapPin,
  MessageCircle,
  Play,
  Save,
  Share2,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";

import { ProjectLogo } from "@/components/project-logo";
import {
  buildMarketingInsights,
  formatCompact,
  formatMetricPercent,
  type MarketingDailyPoint,
  type MarketingAdDetail,
  type MarketingAudienceItem,
  type MarketingPayload,
} from "@/lib/marketing-analytics";
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
};

const INSIGHT_STYLE = {
  positive: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
  info: "border-blue-200 bg-blue-50/70 text-blue-950",
  warning: "border-amber-200 bg-amber-50/80 text-amber-950",
};

function money(value: number, currency: string | null): string {
  if (!currency) return "Несколько валют";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

function MetricCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white px-3.5 py-3">
      <span className={cn("absolute inset-x-0 top-0 h-1", accent)} />
      <p className="truncate text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1.5 truncate text-xl font-semibold tracking-tight text-neutral-950">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

function MetricBand({ payload, type }: { payload: MarketingPayload; type: "organic" | "paid" }) {
  const currency = payload.paid.currencies.length === 1 ? payload.paid.currencies[0] : null;
  const mixedCurrency = payload.paid.currencies.length > 1;
  if (type === "organic") {
    return (
      <section>
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Органика</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Охват" value={formatCompact(payload.organic.reach)} accent="bg-violet-500" />
          <MetricCard label="Рост подписчиков" value={payload.organic.followerGrowth >= 0 ? `+${formatCompact(payload.organic.followerGrowth)}` : formatCompact(payload.organic.followerGrowth)} hint={`${formatCompact(payload.organic.followers)} всего`} accent="bg-fuchsia-500" />
          <MetricCard label="Вовлечённость" value={formatMetricPercent(payload.organic.engagementRate)} accent="bg-pink-500" />
          <MetricCard label="Публикации" value={formatCompact(payload.organic.publications)} accent="bg-orange-400" />
          <MetricCard label="Сохранения" value={formatCompact(payload.organic.saves)} accent="bg-amber-400" />
        </div>
      </section>
    );
  }
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-blue-600" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Платный трафик</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Расход" value={mixedCurrency ? "Несколько валют" : currency ? money(payload.paid.spend, currency) : "—"} accent="bg-blue-600" />
        <MetricCard label="Основные результаты" value={formatCompact(payload.paid.conversions)} accent="bg-cyan-500" />
        <MetricCard label="Стоимость результата" value={payload.paid.cpa === null || !currency ? "—" : money(payload.paid.cpa, currency)} accent="bg-teal-500" />
        <MetricCard label="CTR" value={formatMetricPercent(payload.paid.ctr)} accent="bg-emerald-500" />
        <MetricCard label="ROAS" value={payload.paid.roas === null || !currency ? "—" : `${payload.paid.roas.toFixed(2)}×`} accent="bg-lime-500" />
      </div>
    </section>
  );
}

function linePoints(rows: MarketingDailyPoint[], key: "organicReach" | "paidReach"): string {
  if (!rows.length) return "";
  const max = Math.max(1, ...rows.flatMap((row) => [row.organicReach, row.paidReach]));
  return rows
    .map((row, index) => {
      const x = rows.length === 1 ? 450 : (index / (rows.length - 1)) * 860 + 20;
      const y = 128 - (row[key] / max) * 100;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function ReachChart({
  payload,
  section,
}: {
  payload: MarketingPayload;
  section: "overview" | "content" | "ads";
}) {
  const rows = payload.daily;
  const subtitle =
    section === "content"
      ? "Органический охват по дням"
      : section === "ads"
        ? "Платный охват по дням"
        : "Органика и платный трафик по дням";
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-neutral-950">Динамика охвата</h2>
          <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
        </div>
        <div className="flex gap-4 text-xs text-neutral-500">
          {section !== "ads" && <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-violet-500" />Органика</span>}
          {section !== "content" && <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blue-600" />Реклама</span>}
        </div>
      </div>
      {rows.length ? (
        <div className="mt-2 overflow-x-auto">
          <svg viewBox="0 0 900 152" role="img" aria-label="График охвата" className="h-40 min-w-[640px] w-full">
            {[28, 53, 78, 103, 128].map((y) => (
              <line key={y} x1="20" y1={y} x2="880" y2={y} stroke="#e5e7eb" strokeWidth="1" />
            ))}
            {section !== "ads" && <polyline points={linePoints(rows, "organicReach")} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
            {section !== "content" && <polyline points={linePoints(rows, "paidReach")} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
            <text x="20" y="148" fontSize="11" fill="#737373">{rows[0]?.date.slice(5).split("-").reverse().join(".")}</text>
            <text x="842" y="148" fontSize="11" fill="#737373">{rows.at(-1)?.date.slice(5).split("-").reverse().join(".")}</text>
          </svg>
        </div>
      ) : (
        <div className="mt-2 flex h-40 items-center justify-center rounded-lg bg-neutral-50 text-sm text-neutral-400">За выбранный период данных нет</div>
      )}
    </section>
  );
}

function ChannelContribution({ payload }: { payload: MarketingPayload }) {
  const total = payload.organic.reach + payload.paid.reach;
  const organic = total ? (payload.organic.reach / total) * 100 : 0;
  const paid = total ? (payload.paid.reach / total) * 100 : 0;
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="font-semibold text-neutral-950">Вклад каналов в охват</h2>
      <p className="mt-1 text-xs text-neutral-500">Как распределён контакт с аудиторией</p>
      <div className="mt-6 space-y-5">
        {[
          ["Instagram · органика", organic, "bg-violet-500"],
          ["Meta · реклама", paid, "bg-blue-600"],
        ].map(([label, value, color]) => (
          <div key={String(label)}>
            <div className="mb-2 flex justify-between text-sm"><span className="text-neutral-700">{label}</span><span className="font-semibold text-neutral-950">{Math.round(Number(value))}%</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100"><div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="mt-7 rounded-lg bg-neutral-50 p-4 text-sm text-neutral-600">
        <span className="font-medium text-neutral-900">Общий охват: </span>{formatCompact(total)}
      </div>
    </section>
  );
}

function PerformanceTable({ payload }: { payload: MarketingPayload }) {
  const currency = payload.paid.currencies.length === 1 ? payload.paid.currencies[0] : null;
  const rows = [
    { channel: "Instagram", source: "Органика", reach: payload.organic.reach, engagement: payload.organic.engagementRate, result: payload.organic.followerGrowth, cost: "—", color: "bg-violet-500" },
    { channel: "Meta Ads", source: "Реклама", reach: payload.paid.reach, engagement: payload.paid.ctr, result: payload.paid.conversions, cost: payload.paid.cpa && currency ? money(payload.paid.cpa, currency) : "—", color: "bg-blue-600" },
  ];
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-5 py-4"><h2 className="font-semibold text-neutral-950">Каналы в одном срезе</h2><p className="mt-1 text-xs text-neutral-500">Сравнение органики и рекламы без смешивания смыслов</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-medium text-neutral-500"><tr><th className="px-5 py-3">Канал</th><th className="px-4 py-3">Тип</th><th className="px-4 py-3">Охват</th><th className="px-4 py-3">ER / CTR</th><th className="px-4 py-3">Подписки / результаты</th><th className="px-4 py-3">Стоимость результата</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => <tr key={row.channel}><td className="px-5 py-4 font-medium text-neutral-950"><span className={cn("mr-2 inline-block h-2.5 w-2.5 rounded-full", row.color)} />{row.channel}</td><td className="px-4 py-4 text-neutral-600">{row.source}</td><td className="px-4 py-4 text-neutral-800">{formatCompact(row.reach)}</td><td className="px-4 py-4 text-neutral-800">{formatMetricPercent(row.engagement)}</td><td className="px-4 py-4 text-neutral-800">{formatCompact(row.result)}</td><td className="px-4 py-4 text-neutral-800">{row.cost}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CampaignGoals({ payload }: { payload: MarketingPayload }) {
  if (!payload.paid.campaigns.length) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
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

function BestContent({ payload }: { payload: MarketingPayload }) {
  if (!payload.organic.posts.length) {
    return <section className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center"><Sparkles className="mx-auto h-6 w-6 text-violet-500" /><h2 className="mt-3 font-semibold text-neutral-900">Лучшие публикации появятся после синхронизации Instagram</h2><p className="mt-1 text-sm text-neutral-500">Покажем охват, просмотры, реакции, сохранения и репосты каждой публикации.</p></section>;
  }
  return (
    <section>
      <div className="mb-3 flex items-end justify-between"><div><h2 className="font-semibold text-neutral-950">Лучший контент</h2><p className="mt-1 text-xs text-neutral-500">Публикации с максимальным охватом</p></div></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {payload.organic.posts.slice(0, 6).map((post, index) => (
          <article key={`${post.publishedAt}-${index}`} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="relative aspect-[16/10] bg-neutral-100">
              {post.imageUrl ? (
                // Meta CDN отдаёт временные URL, поэтому изображение загружается напрямую.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.imageUrl} alt="Превью публикации" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : <div className="flex h-full items-center justify-center text-neutral-300"><Play className="h-8 w-8" /></div>}
              <span className="absolute left-3 top-3 rounded-full bg-neutral-950/80 px-2.5 py-1 text-[11px] font-medium text-white">#{index + 1} по охвату</span>
            </div>
            <div className="p-4"><p className="line-clamp-2 min-h-10 text-sm font-medium text-neutral-900">{post.caption || "Публикация без подписи"}</p><div className="mt-4 grid grid-cols-4 gap-2 text-xs text-neutral-500"><span className="flex items-center gap-1"><UsersRound className="h-3.5 w-3.5" />{formatCompact(post.reach)}</span><span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{formatCompact(post.comments)}</span><span className="flex items-center gap-1"><Save className="h-3.5 w-3.5" />{formatCompact(post.saved)}</span><span className="flex items-center gap-1"><Share2 className="h-3.5 w-3.5" />{formatCompact(post.shares)}</span></div>{post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline">Открыть публикацию <ArrowUpRight className="h-3.5 w-3.5" /></a>}</div>
          </article>
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-5 py-4">
          <h3 className="font-semibold text-neutral-950">Все публикации в деталях</h3>
          <p className="mt-1 text-xs text-neutral-500">До 20 публикаций с максимальным охватом за выбранный период</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-medium text-neutral-500">
              <tr><th className="px-5 py-3">Публикация</th><th className="px-4 py-3">Дата</th><th className="px-4 py-3 text-right">Охват</th><th className="px-4 py-3 text-right">Просмотры</th><th className="px-4 py-3 text-right">Реакции</th><th className="px-4 py-3 text-right">Сохранения</th><th className="px-4 py-3 text-right">Репосты</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {payload.organic.posts.slice(0, 20).map((post, index) => (
                <tr key={`${post.publishedAt}-detail-${index}`}>
                  <td className="max-w-[360px] px-5 py-3"><p className="truncate font-medium text-neutral-900">{post.caption || "Публикация без подписи"}</p><p className="mt-0.5 text-xs text-neutral-400">{post.mediaType || "Публикация"}</p></td>
                  <td className="px-4 py-3 whitespace-nowrap text-neutral-600">{new Date(post.publishedAt).toLocaleDateString("ru-RU")}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCompact(post.reach)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCompact(post.views)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCompact(post.engagements)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCompact(post.saved)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCompact(post.shares)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function AdDetailTable({ title, subtitle, rows }: { title: string; subtitle: string; rows: MarketingAdDetail[] }) {
  if (!rows.length) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
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
    return <section className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center"><Target className="mx-auto h-7 w-7 text-blue-600" /><h2 className="mt-3 font-semibold text-neutral-900">Срезы аудитории ещё не загружены</h2><p className="mt-1 text-sm text-neutral-500">Нажмите «Обновить аудиторию Meta» — появятся возраст, пол, страны, регионы и площадки показов.</p></section>;
  }
  return (
    <section>
      <div className="mb-3"><h2 className="font-semibold text-neutral-950">Аудитория и география рекламы</h2><p className="mt-1 text-xs text-neutral-500">Распределение показов Meta за выбранный период</p></div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-xl border border-neutral-200 bg-white p-5"><div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-violet-600" /><h3 className="font-semibold text-neutral-900">Возраст</h3></div><AudienceBars rows={audience.age} color="bg-violet-500" /></article>
        <article className="rounded-xl border border-neutral-200 bg-white p-5"><div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-fuchsia-600" /><h3 className="font-semibold text-neutral-900">Пол</h3></div><AudienceBars rows={audience.gender} color="bg-fuchsia-500" /></article>
        <article className="rounded-xl border border-neutral-200 bg-white p-5"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-600" /><h3 className="font-semibold text-neutral-900">Страны</h3></div><AudienceBars rows={audience.country} color="bg-emerald-500" /></article>
        <article className="rounded-xl border border-neutral-200 bg-white p-5"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-cyan-600" /><h3 className="font-semibold text-neutral-900">Регионы</h3></div><AudienceBars rows={audience.region} color="bg-cyan-500" /></article>
        <article className="rounded-xl border border-neutral-200 bg-white p-5 lg:col-span-2 xl:col-span-2"><div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-blue-600" /><h3 className="font-semibold text-neutral-900">Площадки показов</h3></div><AudienceBars rows={audience.placement} color="bg-blue-600" /></article>
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

function ProjectMark({ payload }: { payload: MarketingPayload }) {
  return <div className="flex items-center gap-3"><ProjectLogo projectId={payload.project.id} name={payload.project.name} logoUrl={payload.project.logoUrl} size="lg" /><div><p className="text-xs font-medium uppercase tracking-[0.15em] text-neutral-400">Маркетинговая аналитика</p><h1 className="text-xl font-semibold text-neutral-950">{payload.project.name}</h1></div></div>;
}

export function MarketingDashboard({
  payload,
  section,
  publicReport = false,
  controls,
  filters,
  contentActions,
  adsPanel,
  audienceActions,
}: MarketingDashboardProps) {
  const insights = buildMarketingInsights(payload);
  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-4"><ProjectMark payload={payload} />{controls}</header>
      {filters}
      {publicReport && <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800"><BadgeCheck className="h-4 w-4" />Актуальный клиентский отчёт · данные доступны только для этого проекта</div>}
      {section === "overview" && (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            {insights.map((insight, index) => <div key={`${insight.title}-${index}`} className={cn("rounded-xl border p-3", INSIGHT_STYLE[insight.tone])}><div className="flex items-start gap-2.5">{insight.tone === "warning" ? <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />}<div><p className="text-sm font-semibold">{insight.title}</p><p className="mt-0.5 text-xs leading-relaxed opacity-75">{insight.detail}</p></div></div></div>)}
          </div>
          <MetricBand payload={payload} type="organic" />
          <MetricBand payload={payload} type="paid" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]"><ReachChart payload={payload} section="overview" /><ChannelContribution payload={payload} /></div>
          <PerformanceTable payload={payload} />
          <AudienceSection payload={payload} actions={audienceActions} hideWhenEmpty={publicReport} />
        </>
      )}
      {section === "content" && (
        <>
          {contentActions}
          <MetricBand payload={payload} type="organic" />
          <ReachChart payload={payload} section="content" />
          <BestContent payload={payload} />
          <AudienceSection payload={payload} actions={audienceActions} hideWhenEmpty={publicReport} />
        </>
      )}
      {section === "ads" && (
        <>
          {adsPanel ?? (
            <>
              <MetricBand payload={payload} type="paid" />
              <ReachChart payload={payload} section="ads" />
              <CampaignGoals payload={payload} />
              <PerformanceTable payload={payload} />
              <AdDetailTable title="Группы объявлений" subtitle="Топ-10 групп по расходу; все значения рассчитаны за выбранный период" rows={payload.paid.adSets} />
              <AdDetailTable title="Объявления" subtitle="Топ-10 объявлений по расходу с результатами и стоимостью результата" rows={payload.paid.ads} />
            </>
          )}
          <AudienceSection payload={payload} actions={audienceActions} hideWhenEmpty={publicReport} />
        </>
      )}
    </div>
  );
}
