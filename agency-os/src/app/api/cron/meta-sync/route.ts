import { syncMetaAdsData } from "@/lib/meta-sync";
import { syncMetaAudienceData } from "@/lib/meta-audience-sync";
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
    const supabase = createServiceClient();
    const period = lastDaysPeriod(new Date(), 7);
    const result = await syncMetaAdsData(supabase, period);
    if (!result.ok) return Response.json(result, { status: 502 });
    // Audience is an independent read-only slice: a partial Meta failure must
    // not invalidate the successful campaign sync.
    try {
      const audience = await syncMetaAudienceData(supabase, period);
      return Response.json({ ...result, audience });
    } catch (error) {
      console.error("Meta audience cron sync failed", error instanceof Error ? error.message : "unknown error");
      return Response.json({ ...result, audience: { ok: false } });
    }
  } catch (error) {
    console.error("Meta cron sync failed", error);
    return Response.json(
      { ok: false, message: "Не удалось обновить Meta." },
      { status: 500 },
    );
  }
}
