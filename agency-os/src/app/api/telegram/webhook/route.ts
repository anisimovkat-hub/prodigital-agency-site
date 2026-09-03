import { timingSafeEqual } from "node:crypto";

import { answerCallbackQuery, sendTelegramMessage } from "@/lib/telegram";
import { createTelegramTaskPreviews } from "@/lib/telegram-task-previews";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramChat = { id: number; type: string; title?: string; first_name?: string };
type TelegramMessage = { message_id: number; chat: TelegramChat; text?: string };
type TelegramUpdate = {
  message?: TelegramMessage;
  my_chat_member?: { chat: TelegramChat; new_chat_member?: { status?: string } };
  callback_query?: { id: string; data?: string; message?: TelegramMessage };
};

function constantTimeMatches(actual: string | null, expected: string | undefined) {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function setupCodeMatches(candidate: string | undefined) {
  return constantTimeMatches(candidate ?? null, process.env.TELEGRAM_SETUP_CODE);
}

async function getOwnerChatId() {
  const { data } = await createServiceClient()
    .from("telegram_bot_settings")
    .select("setting_value")
    .eq("setting_key", "owner_chat_id")
    .maybeSingle();
  return data?.setting_value ?? null;
}

async function isOwner(chat: TelegramChat) {
  return chat.type === "private" && (await getOwnerChatId()) === String(chat.id);
}

function ownerButtons(draftId: string) {
  return [[
    { text: "Отправить сотруднику", callback_data: `tg:send:${draftId}` },
    { text: "Внести правки", callback_data: `tg:edit:${draftId}` },
  ]];
}

async function bindGroupByName(chat: TelegramChat) {
  if (!chat.title || !["group", "supergroup"].includes(chat.type)) return;
  const supabase = createServiceClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,full_name")
    .eq("is_active", true);
  const title = chat.title.toLocaleLowerCase("ru-RU");
  const matches = (profiles ?? []).filter((profile) => {
    const firstName = profile.full_name.trim().split(/\s+/)[0]?.toLocaleLowerCase("ru-RU");
    return firstName && title.includes(firstName);
  });
  await supabase.from("telegram_chat_bindings").upsert({
    chat_id: String(chat.id),
    chat_title: chat.title,
    profile_id: matches.length === 1 ? matches[0].id : null,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "chat_id" });
}

async function handleOwnerMessage(message: TelegramMessage) {
  const text = message.text?.trim();
  if (!text) return;
  const chatId = String(message.chat.id);
  const supabase = createServiceClient();

  if (text.startsWith("/start")) {
    const code = text.split(/\s+/, 2)[1];
    const owner = await getOwnerChatId();
    if (!owner && !setupCodeMatches(code)) {
      await sendTelegramMessage(chatId, "Для первого подключения нужен код из настройки CRM.");
      return;
    }
    if (!owner) {
      await supabase.from("telegram_bot_settings").upsert({
        setting_key: "owner_chat_id",
        setting_value: chatId,
        updated_at: new Date().toISOString(),
      });
    }
    await sendTelegramMessage(chatId, "Готово. Я буду присылать сюда задачи на проверку перед отправкой сотрудникам.");
    await createTelegramTaskPreviews();
    return;
  }

  if (!(await isOwner(message.chat))) return;
  if (text === "/pending") {
    await createTelegramTaskPreviews();
    await sendTelegramMessage(chatId, "Проверила задачи на завтра. Новые черновики уже выше.");
    return;
  }
  if (text.startsWith("/")) return;

  const { data: editingDraft } = await supabase
    .from("telegram_task_drafts")
    .select("id")
    .eq("review_chat_id", chatId)
    .eq("status", "editing")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!editingDraft) return;

  await supabase
    .from("telegram_task_drafts")
    .update({ message_text: text, status: "pending_approval", updated_at: new Date().toISOString() })
    .eq("id", editingDraft.id);
  await sendTelegramMessage(chatId, `Новый вариант:\n\n${text}`, ownerButtons(editingDraft.id));
}

async function handleCallback(callback: NonNullable<TelegramUpdate["callback_query"]>) {
  const message = callback.message;
  const chat = message?.chat;
  if (!chat || !(await isOwner(chat))) return;
  const [, action, draftId] = callback.data?.split(":") ?? [];
  if (!draftId || !["send", "edit"].includes(action)) return;
  const supabase = createServiceClient();
  const { data: draft } = await supabase
    .from("telegram_task_drafts")
    .select("id,recipient_chat_id,message_text,status")
    .eq("id", draftId)
    .eq("review_chat_id", String(chat.id))
    .maybeSingle();
  if (!draft) return;

  if (action === "edit") {
    await supabase
      .from("telegram_task_drafts")
      .update({ status: "editing", updated_at: new Date().toISOString() })
      .eq("id", draft.id);
    await answerCallbackQuery(callback.id);
    await sendTelegramMessage(String(chat.id), "Пришлите следующим сообщением полный текст задачи. Я покажу новый вариант перед отправкой.");
    return;
  }
  if (draft.status === "sent") {
    await answerCallbackQuery(callback.id, "Эта задача уже отправлена.");
    return;
  }

  try {
    const sent = await sendTelegramMessage(draft.recipient_chat_id, draft.message_text);
    await supabase
      .from("telegram_task_drafts")
      .update({ status: "sent", recipient_message_id: sent.message_id, last_error: null, updated_at: new Date().toISOString() })
      .eq("id", draft.id);
    await answerCallbackQuery(callback.id, "Отправлено");
    await sendTelegramMessage(String(chat.id), "Задача отправлена сотруднику.");
  } catch (error) {
    await supabase
      .from("telegram_task_drafts")
      .update({ status: "failed", last_error: error instanceof Error ? error.message.slice(0, 500) : "Telegram send failed" })
      .eq("id", draft.id);
    await answerCallbackQuery(callback.id, "Не удалось отправить. Попробуйте ещё раз.");
  }
}

export async function POST(request: Request) {
  if (!constantTimeMatches(request.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const update = (await request.json()) as TelegramUpdate;
  try {
    if (update.my_chat_member) await bindGroupByName(update.my_chat_member.chat);
    if (update.message) await handleOwnerMessage(update.message);
    if (update.callback_query) await handleCallback(update.callback_query);
  } catch (error) {
    console.error("Telegram webhook handling failed", error);
  }
  return Response.json({ ok: true });
}
