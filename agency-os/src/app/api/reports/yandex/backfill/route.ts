import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { backfillRequiredYandexReports } from "@/lib/yandex-report-backfill";
import { YANDEX_REPORT_REQUIREMENTS } from "@/lib/yandex-report-requirements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

/** Manual owner action only: one approved account, fixed 16–29 October recovery window. */
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "INVALID_ORIGIN" }, { status: 403, headers });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  if (profileError || profile?.role !== "owner" || !profile.is_active)
    return Response.json({ error: "FORBIDDEN" }, { status: 403, headers });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || !("accountId" in body) ||
      typeof body.accountId !== "string" || !YANDEX_REPORT_REQUIREMENTS.some((row) => row.accountId === body.accountId))
    return Response.json({ error: "INVALID_RECOVERY_SCOPE" }, { status: 400, headers });
  try {
    const result = await backfillRequiredYandexReports(createServiceClient(), body.accountId);
    revalidatePath("/analytics");
    return Response.json(result, { headers });
  } catch {
    // Never expose upstream exceptions, headers or server-owned credentials.
    return Response.json({ error: "YANDEX_REPORT_RECOVERY_FAILED" }, { status: 502, headers });
  }
}
