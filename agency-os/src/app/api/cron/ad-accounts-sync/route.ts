import { lastDaysPeriod } from "@/lib/analytics-period";
import { syncConnectedAccounts } from "@/lib/connected-ads-sync";
import { fetchCbrRates } from "@/lib/fx-rates";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Bank of Russia rates for the last ten days, so summaries in USD/RUB stay current. */
async function refreshFxRates(service: ReturnType<typeof createServiceClient>) {
  const days = Array.from({ length: 10 }, (_, index) => new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10));
  const rates = (await Promise.all(days.map((day) => fetchCbrRates(day).catch(() => null)))).flatMap((rows) => rows ?? []);
  if (!rates.length) return 0;
  const { error } = await service.from("fx_rates").upsert(rates, { onConflict: "date,currency" });
  if (error) throw new Error(error.message);
  return rates.length;
}

/** Daily import of accounts connected with their own keys (Yandex Direct, VK Ads, Telegram Ads) and currency rates. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const service = createServiceClient();
    // A rates failure must not stop the ad import; the summary falls back to the last known rate.
    const fxRows = await refreshFxRates(service).catch((error) => { console.error("FX rates refresh failed", error instanceof Error ? error.message : error); return 0; });
    // Семь дней повторно: площадки уточняют конверсии задним числом.
    const result = { ...(await syncConnectedAccounts(service, lastDaysPeriod(new Date(), 7))), fxRows };
    if (result.accounts.some((account) => account.error)) console.error(result.message);
    return Response.json(result, { status: result.ok || result.accounts.length === 0 ? 200 : 502 });
  } catch (error) {
    console.error("Connected ad accounts sync failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok: false, message: "Не удалось обновить подключённые кабинеты." }, { status: 500 });
  }
}
