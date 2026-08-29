import { syncMetaAdsData } from "@/lib/meta-sync";
import { lastDaysPeriod } from "@/lib/analytics-period";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    // Семь дней обновляются повторно: Meta может уточнять атрибуцию задним числом.
    const result = await syncMetaAdsData(
      createServiceClient(),
      lastDaysPeriod(new Date(), 7),
    );
    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    console.error("Meta cron sync failed", error);
    return Response.json(
      { ok: false, message: "Не удалось обновить Meta." },
      { status: 500 },
    );
  }
}
