import { ArrowUpRight, Info } from "lucide-react";
import { SiInstagram as Instagram } from "react-icons/si";
import { formatCompact, formatMetricPercent, type MarketingPayload } from "@/lib/marketing-analytics";
import { contentReportData, type ContentDay } from "@/lib/marketing-content";

const surface = "min-w-0 rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
const shortDate = (date: string) => date.slice(5).split("-").reverse().join(".");

function ContentMetric({ label, value, hint, main = false }: { label: string; value: string; hint: string; main?: boolean }) {
  return <article className={`${surface} px-4 py-3 md:px-5 md:py-4 ${main ? "col-span-2 sm:col-span-1" : ""}`}>
    <p className="text-xs font-medium text-neutral-600 md:text-sm md:text-neutral-700">{label}</p>
    <p className={`mt-2 font-bold leading-tight tracking-tight text-neutral-950 tabular-nums md:text-[32px] ${main ? "text-[28px]" : "text-xl"}`}>{value}</p>
    <p className="mt-2 text-xs text-neutral-400">{hint}</p>
  </article>;
}

function ContentChart({ days, metric, title }: { days: ContentDay[]; metric: "reach" | "engagements"; title: string }) {
  const populated = days.filter((day) => day[metric] !== null);
  const max = Math.max(1, ...populated.map((day) => day[metric]!));
  const x = (index: number) => days.length === 1 ? 280 : 48 + index / (days.length - 1) * 474;
  const y = (value: number) => 150 - value / max * 116;
  // Separate segments at missing days: do not draw a false continuous trend.
  const segments: string[] = [];
  let segment: string[] = [];
  days.forEach((day, index) => {
    const value = day[metric];
    if (value === null) { if (segment.length) segments.push(segment.join(" ")); segment = []; }
    else segment.push(`${x(index)},${y(value)}`);
  });
  if (segment.length) segments.push(segment.join(" "));
  return <section className={`${surface} px-4 py-3 md:px-5 md:py-4`}>
    <h2 className="text-[15px] font-semibold text-neutral-950">{title}</h2>
    <p className="mt-1 text-xs text-neutral-400">По дням выбранного периода</p>
    {!populated.length ? <div className="flex h-44 items-center justify-center text-center text-sm text-neutral-400">Нет загруженных данных за этот период</div> :
      <svg viewBox="0 0 550 184" role="img" aria-label={title} className="mt-3 h-44 w-full">
        {[0, 0.5, 1].map((part) => <g key={part}><line x1="48" x2="522" y1={y(max * part)} y2={y(max * part)} stroke="#f0f0f0" /><text x="40" y={y(max * part) + 4} textAnchor="end" fill="#a3a3a3" fontSize="10">{formatCompact(max * part)}</text></g>)}
        {segments.map((points, index) => <polyline key={index} points={points} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
        {days.map((day, index) => day[metric] !== null && <circle key={day.date} cx={x(index)} cy={y(day[metric]!)} r="2.5" fill="#3b82f6"><title>{shortDate(day.date)}: {formatCompact(day[metric]!)}</title></circle>)}
        <text x="48" y="175" fill="#a3a3a3" fontSize="10">{shortDate(days[0].date)}</text><text x="522" y="175" textAnchor="end" fill="#a3a3a3" fontSize="10">{shortDate(days.at(-1)!.date)}</text>
      </svg>}
  </section>;
}

export function MarketingContentReport({ payload, compact = false }: { payload: MarketingPayload; compact?: boolean }) {
  const { hasMetrics, complete, reportedDays, days, posts } = contentReportData(payload);
  const stat = (value: number) => hasMetrics ? formatCompact(value) : "—";
  const organic = payload.organic;
  return <div className="space-y-3" aria-label={compact ? "Сводка контента" : "Отчёт по контенту"}>
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-neutral-950"><Instagram className="size-4 text-neutral-500" />{compact ? "Контент · кратко" : "Контент и органика"}</h2>
      {organic.connected && <span className="text-xs text-neutral-400">{organic.accountName ? `@${organic.accountName.replace(/^@/, "")}` : "Instagram"}</span>}
    </div>
    {!organic.connected || !hasMetrics ? <div className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600" role="status">
      <Info className="size-4 shrink-0" aria-hidden="true" /><p>{!organic.connected ? "Instagram-аккаунт не подключён к этому проекту." : "За выбранный период нет загруженной ежедневной статистики Instagram. Это не означает нулевой охват. Выберите другой период или обновите источник."}</p>
    </div> : !complete && <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-500" role="status">Данные Instagram загружены за {reportedDays} из {days.length} дней. Итоги неполные; пропуски на графиках не заменены нулями.</p>}
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3" aria-label="Ключевые показатели контента">
      <ContentMetric main label="Охват контента" value={stat(organic.reach)} hint="Сумма дневных охватов, не уникальные люди за период" />
      <ContentMetric label="Взаимодействия" value={stat(organic.engagements)} hint={hasMetrics ? `ER ${formatMetricPercent(organic.engagementRate)} · взаимодействия / охват` : "Нет ежедневных метрик за выбранные даты"} />
      <ContentMetric label="Публикации" value={posts.length ? formatCompact(posts.length) : "—"} hint="Загруженные публикации, вышедшие в выбранный период" />
    </section>
    {!compact && <>
      <div className="grid gap-3 md:grid-cols-2"><ContentChart days={days} metric="reach" title="Охват по дням" /><ContentChart days={days} metric="engagements" title="Взаимодействия по дням" /></div>
      <section className={`${surface} overflow-hidden`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3 pb-2 md:px-5 md:pt-4"><h2 className="text-[15px] font-semibold text-neutral-950">Какие публикации сработали лучше</h2><span className="text-xs text-neutral-400">По охвату · метрики публикаций на момент загрузки</span></div>
        {posts.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-xs">
          <thead className="border-y border-neutral-100 bg-neutral-50/50 text-left text-neutral-400"><tr><th className="px-5 py-2.5 font-medium">Публикация</th><th className="px-3 py-2.5 font-medium">Дата</th>{["Охват", "Просмотры", "Реакции", "Сохранения", "Репосты"].map((name) => <th key={name} className="px-3 py-2.5 text-right font-medium">{name}</th>)}</tr></thead>
          <tbody className="divide-y divide-neutral-100">{posts.map((post, index) => <tr key={`${post.publishedAt}-${index}`} className="hover:bg-neutral-50/50">
            <td className="max-w-[300px] px-5 py-3"><div className="flex items-center gap-2.5">
              {post.imageUrl ? /* Meta CDN URLs are temporary, so load them directly. */
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.imageUrl} alt="" loading="lazy" decoding="async" className="size-9 shrink-0 rounded-lg bg-neutral-100 object-cover" /> : <Instagram className="size-5 shrink-0 text-neutral-300" />}
              <div className="min-w-0"><p className="truncate font-medium text-neutral-900" title={post.caption ?? undefined}>{post.caption || "Публикация без подписи"}</p>{post.permalink ? <a href={post.permalink} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-blue-600">{post.mediaType || "Публикация"}<ArrowUpRight className="size-3" /></a> : <p className="text-[11px] text-neutral-400">{post.mediaType || "Публикация"}</p>}</div>
            </div></td><td className="px-3 py-3 whitespace-nowrap text-neutral-500">{shortDate(post.publishedAt.slice(0, 10))}</td>
            {[post.reach, post.views, post.engagements, post.saved, post.shares].map((value, metric) => <td key={metric} className="px-3 py-3 text-right text-neutral-700 tabular-nums">{formatCompact(value)}</td>)}
          </tr>)}</tbody>
        </table></div> : <p className="px-5 pt-1 pb-5 text-sm text-neutral-500">За выбранные даты публикации не загружены. Старые публикации не подставляются в этот период.</p>}
      </section>
      <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 px-1 text-xs text-neutral-400"><span>Подписчиков · последний снимок <strong className="ml-1 text-neutral-800">{organic.connected ? formatCompact(organic.followers) : "—"}</strong></span><span>Изменение за период <strong className="ml-1 text-neutral-800">{hasMetrics ? `${organic.followerGrowth > 0 ? "+" : ""}${formatCompact(organic.followerGrowth)}` : "—"}</strong></span><span>Сохранений у загруженных публикаций <strong className="ml-1 text-neutral-800">{posts.length ? formatCompact(organic.saves) : "—"}</strong></span></div>
    </>}
  </div>;
}
