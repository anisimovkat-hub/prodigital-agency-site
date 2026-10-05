"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Granularity, TimeseriesPoint } from "@/lib/ad-analytics";
import { formatAdMoney, formatAdNumber } from "@/lib/project-ad-dashboard";

const HEIGHT = 210;
const TOP = 24;
const BOTTOM = HEIGHT - 28;
const LEFT = 40;
const RIGHT_PAD = 10;
const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function bucketLabel(bucket: string, granularity: Granularity): string {
  const date = new Date(`${bucket}T00:00:00Z`);
  if (granularity === "month") return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

function bucketTitle(bucket: string, granularity: Granularity): string {
  return granularity === "week" ? `Неделя с ${bucketLabel(bucket, "day")}` : bucketLabel(bucket, granularity);
}

/** Rounded axis maximum that splits into four readable steps. */
function niceMaximum(value: number): number {
  if (value <= 0) return 4;
  const step = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(step));
  const nice = [1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= step) ?? 10;
  return nice * magnitude * 4;
}

function compact(value: number): string {
  if (value >= 1_000_000) return `${formatAdNumber(value / 1_000_000, 1)} млн`;
  if (value >= 10_000) return `${formatAdNumber(value / 1_000, 0)} тыс`;
  return formatAdNumber(value, value < 10 && value % 1 ? 1 : 0);
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return <article className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <h3 className="text-[15px] font-semibold text-neutral-950">{title}</h3>
    <div className="mt-3">{children}</div>
  </article>;
}

function Empty({ text }: { text: string }) {
  return <p className="flex items-center justify-center text-center text-sm text-neutral-400" style={{ height: HEIGHT }}>{text}</p>;
}

type ChartProps = {
  points: TimeseriesPoint[];
  granularity: Granularity;
  maximum: number;
  format: (value: number) => string;
  tooltip: (point: TimeseriesPoint) => string;
  children: (geometry: { x: (index: number) => number; y: (value: number) => number; slot: number }) => ReactNode;
};

function Chart({ points, granularity, maximum, format, tooltip, children }: ChartProps) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const right = width - RIGHT_PAD;
  const slot = (right - LEFT) / Math.max(1, points.length);
  const x = (index: number) => LEFT + slot * (index + 0.5);
  const y = (value: number) => BOTTOM - (value / maximum) * (BOTTOM - TOP);
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor((right - LEFT) / 64))));
  return <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
    <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} className="block max-w-full" role="img">
      {[0, 1, 2, 3, 4].map((step) => {
        const value = (maximum * step) / 4;
        return <g key={step}>
          <line x1={LEFT} x2={right} y1={y(value)} y2={y(value)} stroke="#eef1f5" strokeDasharray={step ? "3 4" : undefined} />
          <text x={LEFT - 8} y={y(value) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{format(value)}</text>
        </g>;
      })}
      {hover !== null && <rect x={x(hover) - slot / 2} y={TOP - 8} width={slot} height={BOTTOM - TOP + 8} fill="#f1f5f9" rx="6" />}
      {children({ x, y, slot })}
      {points.map((point, index) => index === points.length - 1 || (index % labelEvery === 0 && points.length - 1 - index >= labelEvery * 0.6)
        ? <text key={point.bucket} x={x(index)} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="#94a3b8">{bucketLabel(point.bucket, granularity)}</text>
        : null)}
      {points.map((point, index) => <rect key={`hit-${point.bucket}`} x={x(index) - slot / 2} y={0} width={slot} height={HEIGHT} fill="transparent" onMouseEnter={() => setHover(index)} />)}
    </svg>
    {hover !== null && <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg" style={{ left: Math.min(Math.max(x(hover), 70), width - 70) }}>
      <p className="text-[11px] text-neutral-300">{bucketTitle(points[hover].bucket, granularity)}</p>
      <p className="font-medium tabular-nums">{tooltip(points[hover])}</p>
    </div>}
  </div>;
}

export function AdPerformanceCharts({ points, goalLabel, currency, granularity }: {
  points: TimeseriesPoint[]; goalLabel: string | null; currency: string | null; granularity: Granularity;
}) {
  const interval = granularity === "week" ? "неделям" : granularity === "month" ? "месяцам" : "дням";
  const prices = points.map((point) => (point.conversions > 0 ? point.spend / point.conversions : null));
  const conversionsMax = niceMaximum(Math.max(0, ...points.map((point) => point.conversions)));
  const priceMax = niceMaximum(Math.max(0, ...prices.map((price) => price ?? 0)));
  const hasConversions = points.some((point) => point.conversions > 0);
  const showValues = points.length <= 16;

  return <section className="grid gap-3 lg:grid-cols-2" aria-label="Динамика рекламы">
    <ChartCard title={`Результаты по ${interval}`}>
      {!goalLabel ? <Empty text="Выберите цель, чтобы увидеть результаты" /> : !hasConversions ? <Empty text="За период нет результатов по выбранной цели" /> :
        <Chart points={points} granularity={granularity} maximum={conversionsMax} format={compact}
          tooltip={(point) => `${formatAdNumber(point.conversions)} · ${goalLabel}`}>
          {({ x, y, slot }) => {
            const width = Math.max(3, Math.min(40, slot * 0.6));
            return points.map((point, index) => point.conversions > 0 && <g key={point.bucket}>
              <rect x={x(index) - width / 2} y={y(point.conversions)} width={width} height={BOTTOM - y(point.conversions)} rx={Math.min(5, width / 3)} fill="#5b9cf6" />
              {showValues && <text x={x(index)} y={y(point.conversions) - 7} textAnchor="middle" fontSize="12" fontWeight="600" fill="#334155">{formatAdNumber(point.conversions)}</text>}
            </g>);
          }}
        </Chart>}
    </ChartCard>
    <ChartCard title={`Цена результата по ${interval}`}>
      {!goalLabel ? <Empty text="Выберите цель, чтобы рассчитать цену" /> : !currency ? <Empty text="Кабинеты в разных валютах — выберите один источник" /> : !hasConversions ? <Empty text="Нет результатов для расчёта цены" /> :
        <Chart points={points} granularity={granularity} maximum={priceMax} format={compact}
          tooltip={(point) => point.conversions > 0 ? `${formatAdMoney(point.spend / point.conversions, currency)} · расход ${formatAdMoney(point.spend, currency)}` : `Нет результатов · расход ${formatAdMoney(point.spend, currency)}`}>
          {({ x, y }) => {
            const known = prices.map((price, index) => (price === null ? null : { index, price })).filter((item): item is { index: number; price: number } => item !== null);
            // A day without results has no price: the line breaks instead of inventing a trend.
            const segments: { index: number; price: number }[][] = [];
            known.forEach((item, order) => {
              if (order && item.index === known[order - 1].index + 1) segments[segments.length - 1].push(item);
              else segments.push([item]);
            });
            const path = (segment: typeof known) => segment.map((item, order) => `${order ? "L" : "M"} ${x(item.index).toFixed(1)} ${y(item.price).toFixed(1)}`).join(" ");
            return <>
              <defs><linearGradient id="ad-price-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.16" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></linearGradient></defs>
              {segments.slice(1).map((segment, order) => {
                const previous = segments[order][segments[order].length - 1];
                return <line key={`gap-${segment[0].index}`} x1={x(previous.index)} y1={y(previous.price)} x2={x(segment[0].index)} y2={y(segment[0].price)} stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="4 4" />;
              })}
              {segments.filter((segment) => segment.length > 1).map((segment) => <g key={segment[0].index}>
                <path d={`${path(segment)} L ${x(segment[segment.length - 1].index)} ${BOTTOM} L ${x(segment[0].index)} ${BOTTOM} Z`} fill="url(#ad-price-area)" />
                <path d={path(segment)} fill="none" stroke="#2563eb" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
              </g>)}
              {known.map((item) => <g key={item.index}>
                <circle cx={x(item.index)} cy={y(item.price)} r="4" fill="#2563eb" stroke="white" strokeWidth="2" />
                {showValues && known.length <= 12 && <text x={x(item.index)} y={y(item.price) - 10} textAnchor="middle" fontSize="11" fill="#475569">{item.price < 100 ? formatAdNumber(item.price, 1) : compact(item.price)}</text>}
              </g>)}
            </>;
          }}
        </Chart>}
    </ChartCard>
  </section>;
}
