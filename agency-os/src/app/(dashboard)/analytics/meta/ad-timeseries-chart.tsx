import {
  formatBucketLabel,
  type Granularity,
  type TimeseriesPoint,
} from "@/lib/ad-analytics";

// Лёгкий SVG-график без сторонних библиотек: расход — столбцами (левая шкала),
// конверсии по выбранной цели — линией (правая шкала). Тултипы — нативный SVG
// <title>, поэтому компонент серверный и не тянет клиентский JS.

const W = 1000;
const H = 320;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 16;
const PAD_B = 30;
const INNER_W = W - PAD_L - PAD_R;

function fmt(value: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

export function AdTimeseriesChart({
  points,
  granularity,
  currency,
  goalLabel,
  compact = false,
}: {
  points: TimeseriesPoint[];
  granularity: Granularity;
  currency: string | null;
  goalLabel: string | null;
  compact?: boolean;
}) {
  if (points.length === 0) {
    return (
      <div className="flex h-full min-h-44 items-center justify-center rounded-xl border border-neutral-200 bg-white p-5 text-center text-sm text-neutral-500">
        Нет данных за выбранный период. Измените фильтры или обновите статистику.
      </div>
    );
  }

  const maxSpend = Math.max(1, ...points.map((p) => p.spend));
  const maxConv = Math.max(1, ...points.map((p) => p.conversions));
  const chartHeight = compact ? H : 80;
  const topPadding = compact ? PAD_T : 3;
  const bottomPadding = compact ? PAD_B : 3;
  const innerHeight = chartHeight - topPadding - bottomPadding;
  const baseY = topPadding + innerHeight;
  const n = points.length;
  const step = INNER_W / n;
  const barW = Math.min(48, step * 0.62);
  const cur = currency ?? "";

  const x = (i: number) => PAD_L + (i + 0.5) * step;
  const spendY = (v: number) => topPadding + innerHeight * (1 - v / maxSpend);
  const convY = (v: number) => topPadding + innerHeight * (1 - v / maxConv);

  const hasConversions = goalLabel !== null && maxConv > 1;
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${convY(p.conversions).toFixed(1)}`)
    .join(" ");

  // Подписи оси X прореживаем, чтобы не налезали друг на друга.
  const labelEvery = Math.max(1, Math.ceil(n / 14));

  return (
    <div className={compact
      ? "flex h-full min-h-44 flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
      : "flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3"}>
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-neutral-600">
          <span className="inline-block h-3 w-3 rounded-sm bg-blue-500" />
          Расход{cur ? `, ${cur}` : ""} · макс. {fmt(maxSpend)}
        </span>
        {hasConversions && (
          <span className="flex items-center gap-1.5 text-neutral-600">
            <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" />
            {goalLabel} · макс. {fmt(maxConv)}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${chartHeight}`}
        preserveAspectRatio={compact ? "xMidYMid meet" : "none"}
        className={compact ? "mt-auto h-auto w-full" : "h-20 w-full"}
        role="img"
        aria-label="График расхода и конверсий по времени"
      >
        {/* базовая линия */}
        <line x1={PAD_L} y1={baseY} x2={W - PAD_R} y2={baseY} stroke="#e5e5e5" strokeWidth={1} />

        {/* столбцы расхода */}
        {points.map((p, i) => {
          const y = spendY(p.spend);
          const label = formatBucketLabel(p.bucket, granularity);
          return (
            <rect
              key={`bar-${p.bucket}`}
              x={x(i) - barW / 2}
              y={y}
              width={barW}
              height={Math.max(0, baseY - y)}
              rx={2}
              fill="#3b82f6"
              opacity={0.85}
            >
              <title>
                {label}: расход {fmt(p.spend)}
                {cur ? ` ${cur}` : ""}
                {hasConversions ? `, ${goalLabel?.toLowerCase()} ${fmt(p.conversions)}` : ""}
              </title>
            </rect>
          );
        })}

        {/* линия конверсий */}
        {hasConversions && (
          <>
            <path d={linePath} fill="none" stroke="#10b981" strokeWidth={2.5} />
            {points.map((p, i) => (
              <circle
                key={`pt-${p.bucket}`}
                cx={x(i)}
                cy={convY(p.conversions)}
                r={4}
                fill="#10b981"
              >
                <title>
                  {formatBucketLabel(p.bucket, granularity)}: {goalLabel} {fmt(p.conversions)}
                </title>
              </circle>
            ))}
          </>
        )}

        {/* подписи оси X */}
        {compact && points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text
              key={`lbl-${p.bucket}`}
              x={x(i)}
              y={chartHeight - 8}
              textAnchor="middle"
              fontSize={20}
              fill="#737373"
            >
              {formatBucketLabel(p.bucket, granularity)}
            </text>
          ) : null,
        )}
      </svg>
      {!compact && (
        <div className="flex justify-between text-[11px] text-neutral-500" aria-hidden="true">
          <span>{formatBucketLabel(points[0].bucket, granularity)}</span>
          {points.length > 2 && <span>{formatBucketLabel(points[Math.floor((points.length - 1) / 2)].bucket, granularity)}</span>}
          {points.length > 1 && <span>{formatBucketLabel(points[points.length - 1].bucket, granularity)}</span>}
        </div>
      )}
    </div>
  );
}
