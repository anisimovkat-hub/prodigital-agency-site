import { createServiceClient } from "@/lib/supabase/service";
import { sendTelegramMessage } from "@/lib/telegram";
import { resolveTelegramRecipientChatId } from "@/lib/telegram-recipient";

type ScheduledCompletion = {
  id: string;
  recipient_profile_id: string;
  client_label: string;
  application_number: number;
  campaign_name: string;
  scheduled_for: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return month && day ? `${day}.${month}` : isoDate;
}

/** The fixed, action-oriented handoff the advertising specialist needs at shutdown. */
export function formatCampaignCompletionMessage(completion: Pick<ScheduledCompletion,
  "client_label" | "application_number" | "campaign_name" | "scheduled_for"
>): string {
  return [
    `<b>${escapeHtml(completion.client_label)} / заявка ${completion.application_number} / ${escapeHtml(completion.campaign_name)}</b>`,
    `<b>Завершение РК — ${shortDate(completion.scheduled_for)}</b>`,
    "Нужно прислать номера всех РК.",
    "Нужно прислать общую статистику по этой РК после отключения.",
  ].join("\n\n");
}

function moscowToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Sends due campaign-completion reminders directly to the assigned specialist. */
export async function sendDueCampaignCompletionMessages(now = new Date()) {
  const supabase = createServiceClient();
  const scheduledFor = moscowToday(now);
  const { data, error } = await supabase
    .from("telegram_scheduled_messages")
    .select("id,recipient_profile_id,client_label,application_number,campaign_name,scheduled_for")
    .eq("scheduled_for", scheduledFor)
    .eq("status", "pending")
    .order("application_number");
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  for (const completion of (data ?? []) as ScheduledCompletion[]) {
    try {
      const chatId = await resolveTelegramRecipientChatId(completion.recipient_profile_id);
      if (!chatId) throw new Error("No active Telegram chat is bound to the recipient profile.");
      const message = await sendTelegramMessage(chatId, formatCampaignCompletionMessage(completion));
      const { error: updateError } = await supabase
        .from("telegram_scheduled_messages")
        .update({ status: "sent", sent_at: new Date().toISOString(), sent_message_id: message.message_id, last_error: null })
        .eq("id", completion.id);
      if (updateError) throw updateError;
      sent += 1;
    } catch (sendError) {
      await supabase
        .from("telegram_scheduled_messages")
        .update({
          status: "failed",
          last_error: sendError instanceof Error ? sendError.message.slice(0, 500) : "Telegram send failed",
        })
        .eq("id", completion.id);
      failed += 1;
    }
  }
  return { scheduledFor, sent, failed };
}
