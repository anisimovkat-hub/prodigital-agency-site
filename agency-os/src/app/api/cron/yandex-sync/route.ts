import { lastDaysPeriod } from "@/lib/analytics-period";
import { createServiceClient } from "@/lib/supabase/service";
import { syncYandexDirect } from "@/lib/yandex-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    // Семь дней повторно: Яндекс уточняет конверсии задним числом.
    const result = await syncYandexDirect(createServiceClient(), lastDaysPeriod(new Date(), 7));
    if (result.accounts.some((account) => account.error)) console.error(result.message);
    return Response.json(result, { status: result.ok || result.accounts.length === 0 ? 200 : 502 });
  } catch (error) {
    console.error("Yandex Direct cron sync failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok: false, message: "Не удалось обновить Яндекс.Директ." }, { status: 500 });
  }
}
