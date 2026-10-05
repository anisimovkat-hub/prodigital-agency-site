import { lastDaysPeriod } from "@/lib/analytics-period";
import { syncConnectedAccounts } from "@/lib/connected-ads-sync";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Daily import of accounts connected with their own keys: Yandex Direct, VK Ads, Telegram Ads. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    // Семь дней повторно: площадки уточняют конверсии задним числом.
    const result = await syncConnectedAccounts(createServiceClient(), lastDaysPeriod(new Date(), 7));
    if (result.accounts.some((account) => account.error)) console.error(result.message);
    return Response.json(result, { status: result.ok || result.accounts.length === 0 ? 200 : 502 });
  } catch (error) {
    console.error("Connected ad accounts sync failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok: false, message: "Не удалось обновить подключённые кабинеты." }, { status: 500 });
  }
}
