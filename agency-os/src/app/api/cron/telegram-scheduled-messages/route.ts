import { sendDueCampaignCompletionMessages } from "@/lib/telegram-campaign-completions";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ ok: false }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await sendDueCampaignCompletionMessages()) });
  } catch (error) {
    console.error("Telegram scheduled-message delivery failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
