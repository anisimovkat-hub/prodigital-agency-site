const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type AnalyticsPeriod = {
  from: string;
  to: string;
};

export const PERIOD_PRESETS = [7, 14, 30, 90, 180, 365] as const;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Последние N календарных дней включительно: 7 дней = сегодня и шесть дней до него. */
export function lastDaysPeriod(today: Date, days: number): AnalyticsPeriod {
  const to = new Date(today);
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export function todayPeriod(today: Date): AnalyticsPeriod {
  const date = toIsoDate(today);
  return { from: date, to: date };
}

export function yesterdayPeriod(today: Date): AnalyticsPeriod {
  return lastDaysPeriod(new Date(today.getTime() - 86_400_000), 1);
}

export function thisWeekPeriod(today: Date): AnalyticsPeriod {
  const end = new Date(today);
  const start = new Date(today);
  const day = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - day + 1);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

export function previousWeekPeriod(today: Date): AnalyticsPeriod {
  const current = thisWeekPeriod(today);
  const end = new Date(`${current.from}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

export function thisMonthPeriod(today: Date): AnalyticsPeriod {
  const end = new Date(today);
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

export function previousMonthPeriod(today: Date): AnalyticsPeriod {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

export function periodPresetFor(
  period: AnalyticsPeriod,
  today: Date,
): number | null {
  return PERIOD_PRESETS.find((days) => {
    const preset = lastDaysPeriod(today, days);
    return preset.from === period.from && preset.to === period.to;
  }) ?? null;
}

export function parseAnalyticsPeriod(
  values: { from?: FormDataEntryValue | null; to?: FormDataEntryValue | null },
  today = new Date(),
): AnalyticsPeriod | null {
  const from = typeof values.from === "string" ? values.from : "";
  const to = typeof values.to === "string" ? values.to : "";
  if (!from && !to) return lastDaysPeriod(today, 30);
  if (!isValidIsoDate(from) || !isValidIsoDate(to) || from > to) return null;

  const difference =
    (new Date(`${to}T00:00:00.000Z`).getTime() -
      new Date(`${from}T00:00:00.000Z`).getTime()) /
    86_400_000;
  return difference <= 364 ? { from, to } : null;
}

export function formatAnalyticsPeriod(period: AnalyticsPeriod): string {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${period.from}T00:00:00.000Z`))} — ${formatter.format(new Date(`${period.to}T00:00:00.000Z`))}`;
}
