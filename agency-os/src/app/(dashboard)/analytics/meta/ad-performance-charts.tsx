import { formatBucketLabel, type Granularity, type TimeseriesPoint } from "@/lib/ad-analytics";

const W = 600;
const H = 170;
const TOP = 14;
const BOTTOM = 148;

function ChartFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <article className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
    <h3 className="text-sm font-semibold text-neutral-950">{title}</h3>
    <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
    <div className="mt-4">{children}</div>
  </article>;
}

function axis(points: TimeseriesPoint[], granularity: Granularity) {
  const indexes = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  return <div className="mt-1 flex justify-between text-[11px] tabular-nums text-neutral-400">
    {indexes.map((index, position) => <span key={position}>{points[index] ? formatBucketLabel(points[index].bucket, granularity) : ""}</span>)}
  </div>;
}

export function AdPerformanceCharts({ points, goalLabel, currency, granularity }: {
  points: TimeseriesPoint[]; goalLabel: string | null; currency: string | null; granularity: Granularity;
}) {
  const maxConversions = Math.max(1, ...points.map((point) => point.conversions));
  const cpaPoints = points.map((point) => point.conversions > 0 ? point.spend / point.conversions : null);
  const maxCpa = Math.max(1, ...cpaPoints.map((value) => value ?? 0));
  const x = (index: number) => (index + 0.5) * W / Math.max(1, points.length);
  const cpaY = (value: number) => BOTTOM - value / maxCpa * (BOTTOM - TOP);
  const segments: string[] = [];
  let segment = "";
  cpaPoints.forEach((value, index) => {
    if (value === null) {
      if (segment) segments.push(segment);
      segment = "";
    } else {
      segment += `${segment ? " L" : "M"} ${x(index).toFixed(1)} ${cpaY(value).toFixed(1)}`;
    }
  });
  if (segment) segments.push(segment);

  return <section className="grid gap-3 lg:grid-cols-2" aria-label="Динамика рекламы">
    <ChartFrame title="Динамика целевых действий" subtitle={goalLabel ? `${goalLabel} по дням` : "Выберите одну цель для графика"}>
      {goalLabel && points.length ? <><svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label={`График: ${goalLabel} по датам`}>
        {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2={W} y1={TOP + i * 44} y2={TOP + i * 44} stroke="#f0f1f4" />)}
        {points.map((point, index) => {
          const width = Math.min(34, W / Math.max(1, points.length) * 0.64);
          const height = point.conversions / maxConversions * (BOTTOM - TOP);
          return <rect key={point.bucket} x={x(index) - width / 2} y={BOTTOM - height} width={width} height={height} rx="3" fill="#2563eb"><title>{point.bucket}: {point.conversions.toLocaleString("ru-RU")} · {goalLabel}</title></rect>;
        })}
      </svg>{axis(points, granularity)}</> : <p className="flex h-40 items-center justify-center text-center text-sm text-neutral-400">{goalLabel ? "За период нет данных" : "Цель пока не выбрана"}</p>}
    </ChartFrame>
    <ChartFrame title="Динамика цены цели" subtitle={goalLabel ? `${currency ?? "Валюта кабинета"} за результат` : "Покажем цену выбранной цели по дням"}>
      {goalLabel && currency && cpaPoints.some((value) => value !== null) ? <><svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label={`График цены цели по датам, ${currency}`}>
        {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2={W} y1={TOP + i * 44} y2={TOP + i * 44} stroke="#f0f1f4" />)}
        {segments.map((path, index) => <path key={index} d={path} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />)}
        {cpaPoints.map((value, index) => value === null ? null : <circle key={points[index].bucket} cx={x(index)} cy={cpaY(value)} r="3.5" fill="#10b981"><title>{points[index].bucket}: {value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} {currency}</title></circle>)}
      </svg>{axis(points, granularity)}</> : <p className="flex h-40 items-center justify-center text-center text-sm text-neutral-400">{!currency ? "Нужен один валютный кабинет" : "Нет результатов для расчёта цены"}</p>}
    </ChartFrame>
  </section>;
}
