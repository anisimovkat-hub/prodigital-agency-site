/** Bank of Russia daily rates: rubles per one unit of a currency on a date. */
export type FxRate = { date: string; currency: string; rub_per_unit: number };

/** Currencies of the agency's ad accounts; RUB is the base and needs no rate. */
export const FX_CURRENCIES = ["USD", "EUR", "GBP", "AED", "IDR", "KZT", "TRY", "THB", "GEL", "CNY", "BYN", "UZS"] as const;

/** Rates for one day, or null on weekends and holidays when the bank publishes none. */
export async function fetchCbrRates(date: string): Promise<FxRate[] | null> {
  const [year, month, day] = date.split("-");
  const response = await fetch(`https://www.cbr-xml-daily.ru/archive/${year}/${month}/${day}/daily_json.js`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Курсы ЦБ недоступны (${response.status}).`);
  const json = (await response.json()) as { Valute?: Record<string, { Value: number; Nominal: number }> };
  return FX_CURRENCIES.flatMap((currency) => {
    const rate = json.Valute?.[currency];
    return rate && rate.Value > 0 && rate.Nominal > 0 ? [{ date, currency, rub_per_unit: rate.Value / rate.Nominal }] : [];
  });
}

/**
 * Converter for summaries: an amount on a date into the display currency. A day without a
 * published rate uses the latest earlier one. Returns null when a currency has no rate at all.
 */
export function makeConverter(rates: FxRate[], display: string) {
  const byCurrency = new Map<string, { date: string; rub: number }[]>();
  for (const rate of rates) {
    if (!Number.isFinite(Number(rate.rub_per_unit)) || Number(rate.rub_per_unit) <= 0) continue;
    const list = byCurrency.get(rate.currency) ?? [];
    list.push({ date: rate.date, rub: Number(rate.rub_per_unit) });
    byCurrency.set(rate.currency, list);
  }
  for (const list of byCurrency.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  const rubPerUnit = (currency: string, date: string): number | null => {
    if (currency === "RUB") return 1;
    const list = byCurrency.get(currency);
    if (!list?.length) return null;
    let found: number | null = null;
    for (const item of list) {
      if (item.date > date) break;
      found = item.rub;
    }
    return found;
  };
  return (amount: number, currency: string | null, date: string): number | null => {
    if (!currency) return null;
    if (currency === display) return amount;
    const from = rubPerUnit(currency, date);
    const to = rubPerUnit(display, date);
    return from === null || to === null ? null : (amount * from) / to;
  };
}
