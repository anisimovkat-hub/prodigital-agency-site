import { timingSafeEqual } from "node:crypto";

import { answerCallbackQuery, sendTelegramMessage } from "@/lib/telegram";
import { createTelegramTaskPreviews, resendOpenTelegramTaskPreviews, sendTelegramTaskPreview } from "@/lib/telegram-task-previews";
import { sendOwnerWeeklyStatusPreview } from "@/lib/telegram-weekly-statuses";
import { createServiceClient } from "@/lib/supabase/service";
import { handleTelegramIntakeChoice, handleTelegramTaskText, queueTelegramVoice } from "@/lib/telegram-task-intake";
import { resolveTelegramRecipientChatId } from "@/lib/telegram-recipient";
import { formatTelegramTaskMessage } from "@/lib/telegram-task-message";
import { isVercelPreview } from "@/lib/preview-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramChat = { id: number; type: string; title?: string; first_name?: string };
type TelegramMessage = { message_id: number; chat: TelegramChat; from?: { id: number }; text?: string; voice?: { file_id: string; file_unique_id: string } };
type TelegramUpdate = {
  message?: TelegramMessage;
  my_chat_member?: { chat: TelegramChat; new_chat_member?: { status?: string } };
  callback_query?: { id: string; from?: { id: number }; data?: string; message?: TelegramMessage };
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

async function isOwner(chat: TelegramChat, senderId: number | undefined) {
  const ownerId = await getOwnerChatId();
  return chat.type === "private" && ownerId === String(chat.id) && ownerId === String(senderId);
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
  const chatId = String(message.chat.id);
  const supabase = createServiceClient();
  if (text?.startsWith("/start") && !(await getOwnerChatId()) && message.chat.type === "private" && message.from?.id === message.chat.id) {
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

  if (!(await isOwner(message.chat, message.from?.id))) {
    if (message.chat.type === "private") await sendTelegramMessage(chatId, "Создавать и отправлять задачи через этого бота может только владелец агентства.");
    return;
  }
  const expired = await supabase.rpc("expire_telegram_intake_drafts");
  if (expired.error) throw expired.error;
  if (message.voice) { await queueTelegramVoice(chatId, message.message_id, message.voice); return; }
  if (!text) return;
  if (text.startsWith("/start")) {
    await sendTelegramMessage(chatId, "Напишите задачу: кому, по какому проекту и к какому сроку. Я сохраню черновик и покажу его вам перед отправкой.");
    return;
  }
  if (text === "/pending") {
    const result = await createTelegramTaskPreviews(new Date(), { refreshPending: true });
    const resent = await resendOpenTelegramTaskPreviews();
    const total = result.created + resent;
    await sendTelegramMessage(
      chatId,
      total ? "Обновила черновики — они уже выше." : "Нет задач, готовых к отправке.",
    );
    return;
  }
  if (text === "/status" || text.startsWith("/status ")) {
    await sendTelegramMessage(chatId, await sendOwnerWeeklyStatusPreview(chatId, text.slice("/status".length)));
    return;
  }
  if (text.startsWith("/")) return;
  await handleTelegramTaskText(chatId, message.message_id, text);
}

async function handleCallback(callback: NonNullable<TelegramUpdate["callback_query"]>) {
  const message = callback.message;
  const chat = message?.chat;
  if (!chat || !(await isOwner(chat, callback.from?.id))) {
    await answerCallbackQuery(callback.id, "Эта кнопка доступна только владельцу."); return;
  }
  const expiry = await createServiceClient().rpc("expire_telegram_intake_drafts");
  if (expiry.error) throw expiry.error;
  if (callback.data?.startsWith("ji:")) { await handleTelegramIntakeChoice(String(chat.id), callback.id, callback.data); return; }
  const [, action, draftId] = callback.data?.split(":") ?? [];
  if (!draftId || !/^[0-9a-f-]{36}$/.test(draftId) || !["send", "edit", "cancel"].includes(action)) return;
  const supabase = createServiceClient();
  const { data: draft } = await supabase
    .from("telegram_task_drafts")
    .select("id,task_id,recipient_profile_id,recipient_chat_id,message_text,status,expires_at")
    .eq("id", draftId)
    .eq("review_chat_id", String(chat.id))
    .maybeSingle();
  if (!draft) return;

  if (["sent", "sending", "cancelled"].includes(draft.status)) {
    await answerCallbackQuery(callback.id, draft.status === "sent" ? "Эта задача уже отправлена." : draft.status === "sending" ? "Отправка уже начата. Повторно не отправляю." : "Черновик отменён."); return;
  }
  if (action === "cancel") {
    const result = await supabase.rpc("cancel_telegram_task_draft", { p_draft_id: draft.id, p_owner_chat_id: String(chat.id) });
    if (result.error) throw result.error;
    await answerCallbackQuery(callback.id, result.data ? "Отменено" : "Черновик уже обработан");
    if (result.data) await sendTelegramMessage(String(chat.id), "Черновик отменён. Сотруднику ничего не отправлено.");
    return;
  }

  if (action === "edit") {
    const open = await supabase.from("telegram_task_drafts").select("id").eq("review_chat_id", String(chat.id)).eq("status", "editing").neq("id", draft.id).limit(1);
    if (open.error) throw open.error;
    if (open.data?.length) { await answerCallbackQuery(callback.id, "Сначала завершите правку предыдущей задачи."); return; }
    const edited = await supabase
      .from("telegram_task_drafts")
      .update({ status: "editing", updated_at: new Date().toISOString() })
      .eq("id", draft.id).in("status", ["pending_approval", "failed"]).select("id").maybeSingle();
    if (edited.error) throw edited.error;
    if (!edited.data) { await answerCallbackQuery(callback.id, "Черновик уже обработан."); return; }
    await answerCallbackQuery(callback.id);
    await sendTelegramMessage(String(chat.id), "Пришлите новый текст задачи или правку: «срок завтра», «исполнитель Софа», «название: …», «описание: …». Я обновлю задачу в CRM и покажу новый черновик.");
    return;
  }
  const { data: task, error: taskError } = await supabase.from("tasks").select("assignee_id,title,description,due_date,workstream,status,projects(stage,name)").eq("id", draft.task_id).single();
  if (taskError) throw taskError;
  const project = task.projects as { stage: string | null; name: string } | null;
  if (["done", "cancelled", "paused"].includes(task.status ?? "") || (project && !["active", "launching"].includes(project.stage ?? ""))) {
    await answerCallbackQuery(callback.id, "Задача или проект уже остановлены."); return;
  }
  const recipient = task.assignee_id ? await resolveTelegramRecipientChatId(task.assignee_id) : null;
  if (!recipient) { await answerCallbackQuery(callback.id, "Рабочий чат сотрудника ещё не подключён."); return; }
  const currentMessage = formatTelegramTaskMessage({ projectName: project?.name ?? null, title: task.title, description: task.description, dueDate: task.due_date, workstream: task.workstream });
  if (currentMessage !== draft.message_text || task.assignee_id !== draft.recipient_profile_id) {
    await sendTelegramTaskPreview(draft.task_id, { refreshPending: true, existingDraftId: draft.id });
    await answerCallbackQuery(callback.id, "Задача изменилась. Проверьте новый черновик."); return;
  }
  // One button click claims delivery. Ambiguous network failures stay 'sending'
  // until the owner checks the chat; automatic retries cannot send a duplicate.
  const claim = await supabase.rpc("claim_telegram_task_delivery", { p_draft_id: draft.id, p_owner_chat_id: String(chat.id) });
  if (claim.error) throw claim.error;
  if (claim.data !== "claimed") { await answerCallbackQuery(callback.id, claim.data === "expired" ? "24 часа истекли. Черновик отменён." : "Черновик уже обработан или недоступен."); return; }
  try {
    const sent = await sendTelegramMessage(recipient, draft.message_text);
    const saved = await supabase.rpc("complete_telegram_task_delivery", { p_draft_id: draft.id, p_recipient_chat_id: recipient, p_message_id: sent.message_id });
    if (saved.error || !saved.data) throw saved.error ?? new Error("Could not confirm delivery");
    await answerCallbackQuery(callback.id, "Отправлено");
    await sendTelegramMessage(String(chat.id), "Задача отправлена сотруднику.");
  } catch {
    await supabase
      .from("telegram_task_drafts")
      .update({ last_error: "Delivery needs manual verification", updated_at: new Date().toISOString() })
      .eq("id", draft.id);
    await answerCallbackQuery(callback.id, "Проверьте рабочий чат перед повторной отправкой.");
    await sendTelegramMessage(String(chat.id), "Не удалось подтвердить доставку. Проверьте рабочий чат: повторную отправку я заблокировала, чтобы не продублировать задачу.");
  }
}

export async function POST(request: Request) {
  if (isVercelPreview()) return Response.json({ ok: false, reason: "preview_disabled" }, { status: 404 });
  if (!constantTimeMatches(request.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const update = (await request.json()) as TelegramUpdate;
    if (update.my_chat_member) await bindGroupByName(update.my_chat_member.chat);
    if (update.message && update.message.chat.type !== "private") {
      await bindGroupByName(update.message.chat);
    }
    if (update.message) await handleOwnerMessage(update.message);
    if (update.callback_query) await handleCallback(update.callback_query);
  } catch {
    console.error("Telegram webhook handling failed");
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
