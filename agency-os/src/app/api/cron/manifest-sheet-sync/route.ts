import { syncManifestSheet } from "@/lib/manifest-sheet-sync";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await syncManifestSheet(createServiceClient()));
  } catch (error) {
    console.error("Manifest sheet sync failed", error);
    return Response.json({ ok: false, message: "Не удалось обновить статистику Прин и Соды из таблицы" }, { status: 502 });
  }
}
