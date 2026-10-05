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

/** Daily statistics per ad; spend comes in TON. */
export async function fetchTelegramAdDays(token: string, from: string, to: string): Promise<TelegramAdDay[]> {
  const ads = await fetchTelegramAds(token);
  const start = Date.parse(`${from}T00:00:00Z`) / 1000;
  const end = Date.parse(`${to}T00:00:00Z`) / 1000 + 86_400;
  const days: TelegramAdDay[] = [];
  for (const ad of ads) {
    const stats = await request<TelegramStat[]>(token, "getAdStats", { ad_id: ad.ad_id, from_time: start, to_time: end, interval: 86_400 });
    for (const stat of Array.isArray(stats) ? stats : []) {
      if (!Number.isFinite(Number(stat.from_time))) continue;
      const views = Number(stat.views ?? 0), clicks = Number(stat.clicks ?? 0), spendTon = Number(stat.spent_budget ?? 0);
      if (!views && !clicks && !spendTon) continue;
      days.push({
        adId: String(ad.ad_id),
        title: String(ad.title ?? `Объявление ${ad.ad_id}`),
        date: new Date(Number(stat.from_time) * 1000).toISOString().slice(0, 10),
        spendTon, views, clicks, joins: Number(stat.joins ?? 0),
      });
    }
  }
  return days;
}

/** TON → RUB through TON/USD (Kraken) and USD/RUB, as in the existing Sheets script. */
export async function fetchTonRubRate(): Promise<number> {
  const [crypto, fx] = await Promise.all([
    fetch("https://api.kraken.com/0/public/Ticker?pair=TONUSD", { cache: "no-store" }).then((response) => response.json()),
    fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" }).then((response) => response.json()),
  ]) as [{ result?: Record<string, { c?: string[] }> }, { rates?: { RUB?: number } }];
  const tonUsd = Number(Object.values(crypto.result ?? {})[0]?.c?.[0]);
  const usdRub = Number(fx.rates?.RUB);
  if (!(tonUsd > 0) || !(usdRub > 0)) throw new Error("Не удалось получить курс TON/RUB.");
  return tonUsd * usdRub;
}
