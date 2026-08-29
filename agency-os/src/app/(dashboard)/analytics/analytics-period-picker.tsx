"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  lastDaysPeriod,
  previousMonthPeriod,
  previousWeekPeriod,
  thisMonthPeriod,
  thisWeekPeriod,
  todayPeriod,
  yesterdayPeriod,
  type AnalyticsPeriod,
} from "@/lib/analytics-period";
import { cn } from "@/lib/utils";

type Preset = { label: string; getPeriod: (today: Date) => AnalyticsPeriod };

const PRESETS: Preset[] = [
  { label: "Сегодня", getPeriod: todayPeriod },
  { label: "Вчера", getPeriod: yesterdayPeriod },
  { label: "Эта неделя", getPeriod: thisWeekPeriod },
  { label: "Прошлая неделя", getPeriod: previousWeekPeriod },
  { label: "Этот месяц", getPeriod: thisMonthPeriod },
  { label: "Прошлый месяц", getPeriod: previousMonthPeriod },
  { label: "Последние 7 дней", getPeriod: (today) => lastDaysPeriod(today, 7) },
  { label: "Последние 14 дней", getPeriod: (today) => lastDaysPeriod(today, 14) },
  { label: "Последние 30 дней", getPeriod: (today) => lastDaysPeriod(today, 30) },
  { label: "Последние 90 дней", getPeriod: (today) => lastDaysPeriod(today, 90) },
  { label: "Последние 365 дней", getPeriod: (today) => lastDaysPeriod(today, 365) },
];

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthStart(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, amount: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

function formatPeriod(period: AnalyticsPeriod): string {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${period.from}T00:00:00Z`))} — ${formatter.format(new Date(`${period.to}T00:00:00Z`))}`;
}

function CalendarMonth({
  month,
  period,
  onPick,
}: {
  month: Date;
  period: AnalyticsPeriod;
  onPick: (value: string) => void;
}) {
  const firstDay = (month.getUTCDay() || 7) - 1;
  const totalDays = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((firstDay + totalDays) / 7) * 7 }, (_, index) => {
    const day = index - firstDay + 1;
    return day >= 1 && day <= totalDays ? new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day)) : null;
  });
  const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);

  return <div><p className="mb-3 text-center text-sm font-semibold capitalize text-neutral-900">{monthLabel}</p><div className="grid grid-cols-7 gap-y-1 text-center text-[11px] font-medium text-neutral-400">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div><div className="mt-1 grid grid-cols-7 gap-y-1">{cells.map((date, index) => {
    if (!date) return <span key={`empty-${index}`} />;
    const value = toIsoDate(date);
    const selected = value === period.from || value === period.to;
    const between = value > period.from && value < period.to;
    return <button key={value} type="button" onClick={() => onPick(value)} className={cn("mx-auto flex size-8 items-center justify-center rounded-md text-sm tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500", selected ? "bg-blue-600 font-semibold text-white" : between ? "rounded-none bg-blue-100 text-blue-950" : "text-neutral-700 hover:bg-neutral-100")}>{date.getUTCDate()}</button>;
  })}</div></div>;
}

export function AnalyticsPeriodPicker({ period, onApply }: { period: AnalyticsPeriod; onApply: (period: AnalyticsPeriod) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(period);
  const [viewMonth, setViewMonth] = useState(() => monthStart(period.from));
  const [pickingEnd, setPickingEnd] = useState(false);

  const selectedPreset = useMemo(() => {
    const now = new Date();
    return PRESETS.find((preset) => {
      const range = preset.getPeriod(now);
      return range.from === draft.from && range.to === draft.to;
    })?.label ?? "Указать период";
  }, [draft]);

  function apply() {
    if (!draft.from || !draft.to || draft.from > draft.to) return;
    onApply(draft);
    setOpen(false);
  }

  function choosePreset(preset: Preset) {
    const next = preset.getPeriod(new Date());
    setDraft(next);
    setViewMonth(monthStart(next.from));
    setPickingEnd(false);
  }

  function chooseDate(value: string) {
    if (!pickingEnd || value < draft.from) {
      setDraft({ from: value, to: value });
      setPickingEnd(true);
      return;
    }
    setDraft({ from: draft.from, to: value });
    setPickingEnd(false);
  }

  return (
    <div className="relative z-20">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="inline-flex h-10 min-w-[250px] items-center justify-between gap-3 rounded-lg border border-neutral-300 bg-white px-3 text-left text-sm font-medium text-neutral-900 shadow-sm transition hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500">
        <span className="flex min-w-0 items-center gap-2"><CalendarDays className="size-4 shrink-0 text-neutral-500" /><span className="truncate">{formatPeriod(period)}</span></span><ChevronDown className={cn("size-4 shrink-0 text-neutral-500 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="absolute right-0 top-12 grid w-[min(96vw,790px)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl md:grid-cols-[210px_minmax(0,1fr)]"><div className="max-h-[430px] overflow-y-auto border-b border-neutral-200 bg-neutral-50 p-2 md:border-b-0 md:border-r">{PRESETS.map((preset) => <button key={preset.label} type="button" onClick={() => choosePreset(preset)} className={cn("block w-full rounded-md px-3 py-2 text-left text-sm transition hover:bg-white", selectedPreset === preset.label ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-neutral-700")}>{preset.label}</button>)}</div><div className="p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-neutral-950">Указать период</p><p className="mt-1 text-xs text-neutral-500">Нажмите дату начала, затем дату окончания.</p></div><div className="flex gap-1"><button type="button" onClick={() => setViewMonth((month) => addMonths(month, -1))} aria-label="Предыдущий месяц" className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100"><ChevronLeft className="size-4" /></button><button type="button" onClick={() => setViewMonth((month) => addMonths(month, 1))} aria-label="Следующий месяц" className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100"><ChevronRight className="size-4" /></button></div></div><div className="mt-5 grid gap-6 sm:grid-cols-2"><CalendarMonth month={viewMonth} period={draft} onPick={chooseDate} /><CalendarMonth month={addMonths(viewMonth, 1)} period={draft} onPick={chooseDate} /></div><p className="mt-5 text-xs font-medium text-neutral-700">{formatPeriod(draft)}</p><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setDraft(period); setViewMonth(monthStart(period.from)); setPickingEnd(false); setOpen(false); }}>Отмена</Button><Button type="button" onClick={apply}>Обновить</Button></div></div></div>}
    </div>
  );
}
