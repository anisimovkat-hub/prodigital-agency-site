import { timingSafeEqual } from "node:crypto";

import { fetchTalentPressMetaExport } from "@/lib/talent-press-meta-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.TALENT_PRESS_SHEETS_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || supplied.length !== secret.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const payload = await fetchTalentPressMetaExport();
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Do not return Meta token, request URLs or private response contents.
    console.error("Talent Press Meta export failed", error instanceof Error ? error.name : "unknown error");
    return Response.json({ error: "Meta export failed" }, { status: 502 });
  }
}
