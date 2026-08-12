type AdDataFreshnessInput = {
  latestDate: string | null;
  from: string;
  to: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function daysBetween(left: string, right: string): number {
  const leftMs = new Date(`${left}T00:00:00Z`).getTime();
  const rightMs = new Date(`${right}T00:00:00Z`).getTime();
  return Math.round((rightMs - leftMs) / 86_400_000);
}

/**
 * Не даёт пустому выбранному периоду выглядеть как настоящий нулевой расход.
 * Один день допуска оставляем для ещё не закрывшихся суток в Meta.
 */
export function describeAdDataFreshness({
  latestDate,
  from,
  to,
}: AdDataFreshnessInput): string | null {
  if (!latestDate) {
    return "Рекламные данные ещё не загружены. Обновите статистику Meta.";
  }
  if (![latestDate, from, to].every((value) => ISO_DATE.test(value))) {
    return null;
  }

  const lagDays = daysBetween(latestDate, to);
  if (lagDays <= 1) return null;

  const latestLabel = formatDate(latestDate);
  if (latestDate < from) {
    return `Последние рекламные данные — за ${latestLabel}. Выбранный период начинается позже, поэтому нулевые значения ниже не означают отсутствие расхода.`;
  }

  return `Данные Meta отстают на ${lagDays} дн.: последний загруженный день — ${latestLabel}. Обновите статистику перед анализом.`;
}
