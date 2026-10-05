import "server-only";

const API = "https://promoteapi.telegram.org";

type TelegramAd = { ad_id: number | string; title?: string };
type TelegramStat = { from_time?: number; spent_budget?: number | string; views?: number | string; clicks?: number | string; joins?: number | string; actions?: number | string };

async function request<T>(token: string, method: string, params: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  let body: { ok?: boolean; result?: T; error?: string };
  try { body = await response.json(); }
  catch { throw new Error(`Telegram Ads вернул некорректный ответ (${response.status}).`); }
  if (!response.ok || !body.ok) throw new Error(`Telegram Ads: ${body.error ?? response.status}`);
  return body.result as T;
}

export async function fetchTelegramAds(token: string): Promise<TelegramAd[]> {
  const ads: TelegramAd[] = [];
  let offset = "";
  for (let page = 0; page < 100; page += 1) {
    const result = await request<{ ads?: TelegramAd[]; next_offset?: string }>(token, "getAdsList", { limit: 100, ...(offset ? { offset } : {}) });
    ads.push(...(result.ads ?? []));
    if (!result.next_offset) break;
    offset = result.next_offset;
  }
  return ads;
}

export type TelegramAdDay = { adId: string; title: string; date: string; spendTon: number; views: number; clicks: number; joins: number };

async function inParallel<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index]);
    }
  }));
  return results;
}

/** Daily statistics per ad; spend comes in TON. A few ads are requested at once to fit the cron time limit. */
export async function fetchTelegramAdDays(token: string, from: string, to: string): Promise<TelegramAdDay[]> {
  const ads = await fetchTelegramAds(token);
  const start = Date.parse(`${from}T00:00:00Z`) / 1000;
  const end = Date.parse(`${to}T00:00:00Z`) / 1000 + 86_400;
  const perAd = await inParallel(ads, 5, async (ad) => {
    const stats = await request<TelegramStat[]>(token, "getAdStats", { ad_id: ad.ad_id, from_time: start, to_time: end, interval: 86_400 });
    return (Array.isArray(stats) ? stats : []).flatMap((stat) => {
      if (!Number.isFinite(Number(stat.from_time))) return [];
      const views = Number(stat.views ?? 0), clicks = Number(stat.clicks ?? 0), spendTon = Number(stat.spent_budget ?? 0);
      if (!views && !clicks && !spendTon) return [];
      return [{
        adId: String(ad.ad_id),
        title: String(ad.title ?? `Объявление ${ad.ad_id}`),
        date: new Date(Number(stat.from_time) * 1000).toISOString().slice(0, 10),
        spendTon, views, clicks, joins: Number(stat.joins ?? 0),
      }];
    });
  });
  return perAd.flat();
}

/**
 * TON → RUB for each day: the daily TON/USD close (Kraken) times the current USD/RUB.
 * Past days keep their own TON price, so a resync does not re-price old spend.
 */
export async function fetchTonRubRates(from: string): Promise<(date: string) => number> {
  const since = Date.parse(`${from}T00:00:00Z`) / 1000 - 86_400;
  const [ohlc, fx] = await Promise.all([
    fetch(`https://api.kraken.com/0/public/OHLC?pair=TONUSD&interval=1440&since=${since}`, { cache: "no-store" }).then((response) => response.json()),
    fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" }).then((response) => response.json()),
  ]) as [{ result?: Record<string, unknown> }, { rates?: { RUB?: number } }];
  const usdRub = Number(fx.rates?.RUB);
  const candles = Object.entries(ohlc.result ?? {}).find(([key]) => key !== "last")?.[1] as [number, string, string, string, string][] | undefined;
  const closes = new Map((candles ?? []).map((candle) => [new Date(candle[0] * 1000).toISOString().slice(0, 10), Number(candle[4])]));
  const latest = [...closes.values()].at(-1);
  if (!(usdRub > 0) || !(latest && latest > 0)) throw new Error("Не удалось получить курс TON/RUB.");
  return (date) => (closes.get(date) ?? latest) * usdRub;
}
