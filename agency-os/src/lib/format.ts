export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value}%`;
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours} ч`);
  if (remainingMinutes > 0 || hours === 0) {
    parts.push(`${remainingMinutes} мин`);
  }

  return parts.join(" ");
}

export function isOverdue(
  dueDate: string | null | undefined,
  status: string | null | undefined,
): boolean {
  if (!dueDate || status === "done") return false;
  return dueDate < todayISO();
}

export function isDueToday(dueDate: string | null | undefined): boolean {
  return !!dueDate && dueDate === todayISO();
}
