import { sendDueWeeklyAdStatuses } from "@/lib/telegram-weekly-statuses";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await sendDueWeeklyAdStatuses()) });
  } catch (error) {
    console.error("Telegram weekly ad status delivery failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
