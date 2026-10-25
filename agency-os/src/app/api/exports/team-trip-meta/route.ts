import { timingSafeEqual } from "node:crypto";

import { fetchTeamTripMetaExport, teamTripPeriod, TeamTripExportError } from "@/lib/team-trip-meta-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const secret = process.env.TEAM_TRIP_SHEETS_SECRET;
  const supplied = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  const actual = Buffer.from(supplied);
  const expected = Buffer.from(secret ?? "");
  if (!secret || expected.byteLength < 32 || actual.byteLength !== expected.byteLength ||
      !timingSafeEqual(actual, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  let period;
  try {
    period = teamTripPeriod(new URL(request.url).searchParams);
  } catch {
    return Response.json({ error: "INVALID_PERIOD" }, { status: 400, headers });
  }
  try {
    return Response.json(await fetchTeamTripMetaExport(period), { headers });
  } catch (error) {
    const code = error instanceof TeamTripExportError ? error.code : "META_EXPORT_FAILED";
    // Only known safe codes, never raw upstream exceptions/URLs/response bodies.
    return Response.json({ error: code }, { status: 502, headers });
  }
}

// Do not run the export for Next.js's implicit HEAD/OPTIONS handlers.
export function HEAD() { return new Response(null, { status: 405, headers: { ...headers, Allow: "GET" } }); }
export function OPTIONS() { return HEAD(); }
