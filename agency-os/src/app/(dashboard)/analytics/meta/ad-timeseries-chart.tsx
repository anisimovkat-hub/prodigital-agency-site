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
const INNER_H = H - PAD_T - PAD_B;
const BASE_Y = PAD_T + INNER_H;

function fmt(value: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
}

export function AdTimeseriesChart({
  points,
  granularity,
  currency,
  goalLabel,
}: {
  points: TimeseriesPoint[];
  granularity: Granularity;
  currency: string | null;
  goalLabel: string | null;
}) {
  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
        Нет данных за выбранный период. Измените фильтры или обновите статистику.
      </div>
    );
  }

  const maxSpend = Math.max(1, ...points.map((p) => p.spend));
  const maxConv = Math.max(1, ...points.map((p) => p.conversions));
  const n = points.length;
  const step = INNER_W / n;
  const barW = Math.min(48, step * 0.62);
  const cur = currency ?? "";

  const x = (i: number) => PAD_L + (i + 0.5) * step;
  const spendY = (v: number) => PAD_T + INNER_H * (1 - v / maxSpend);
  const convY = (v: number) => PAD_T + INNER_H * (1 - v / maxConv);

  const hasConversions = goalLabel !== null && maxConv > 1;
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${convY(p.conversions).toFixed(1)}`)
    .join(" ");

  // Подписи оси X прореживаем, чтобы не налезали друг на друга.
  const labelEvery = Math.max(1, Math.ceil(n / 14));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
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
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="График расхода и конверсий по времени"
      >
        {/* базовая линия */}
        <line x1={PAD_L} y1={BASE_Y} x2={W - PAD_R} y2={BASE_Y} stroke="#e5e5e5" strokeWidth={1} />

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
              height={Math.max(0, BASE_Y - y)}
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
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text
              key={`lbl-${p.bucket}`}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize={20}
              fill="#737373"
            >
              {formatBucketLabel(p.bucket, granularity)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
