import { createServiceClient } from "@/lib/supabase/service";
import { escapeHtml, formatTelegramTaskMessage, nextMoscowDate } from "@/lib/telegram-task-message";
import { sendTelegramMessage } from "@/lib/telegram";
import { resolveTelegramRecipientChatId } from "@/lib/telegram-recipient";
import { moscowIntakeDate } from "@/lib/task-intake-parser";

export async function ownerChatId(): Promise<string | null> {
  const { data, error } = await createServiceClient().from("telegram_bot_settings")
    .select("setting_value").eq("setting_key", "owner_chat_id").maybeSingle();
  if (error) throw error;
  return data?.setting_value ?? null;
}

export function draftButtons(draftId: string) {
  return [[
    { text: "✅ Отправить сотруднику", callback_data: `tg:send:${draftId}` },
    { text: "✏️ Внести правки", callback_data: `tg:edit:${draftId}` },
  ], [{ text: "Отменить", callback_data: `tg:cancel:${draftId}` }]];
}

/** Shared by the 09:00 cron, text intake, edits and explicit owner resends. */
export async function sendTelegramTaskPreview(taskId: string, options: {
  now?: Date; refreshPending?: boolean; existingDraftId?: string;
} = {}): Promise<boolean> {
  const now = options.now ?? new Date();
  const supabase = createServiceClient();
  const ownerId = await ownerChatId();
  if (!ownerId) return false;
  const { data: task, error } = await supabase.from("tasks")
    .select("id,title,description,due_date,workstream,assignee_id,status,owner_approval_pending,projects(name),assignee:profiles!tasks_assignee_id_fkey(full_name)")
    .eq("id", taskId).maybeSingle();
  if (error) throw error;
  if (!task?.assignee_id || ["done", "cancelled", "paused"].includes(task.status ?? "")) return false;
  const assignee = task.assignee as { full_name: string } | null;
  const project = task.projects as { name: string } | null;
  const recipientChatId = await resolveTelegramRecipientChatId(task.assignee_id, assignee?.full_name);
  if (!recipientChatId && !task.owner_approval_pending) return false;
  const sourceDate = task.due_date ?? moscowIntakeDate(now);
  let query = supabase.from("telegram_task_drafts").select("id,status,expires_at,review_message_id");
  query = options.existingDraftId ? query.eq("id", options.existingDraftId).eq("task_id", task.id)
    : task.owner_approval_pending ? query.eq("task_id", task.id).order("created_at", { ascending: false }).limit(1)
    : query.eq("task_id", task.id).eq("source_date", sourceDate);
  const { data: existing, error: existingError } = await query.maybeSingle();
  if (existingError) throw existingError;
  if (existing && (["sent", "sending", "cancelled"].includes(existing.status) || (!options.refreshPending && existing.status !== "failed" && existing.review_message_id))) return false;
  if (existing?.expires_at && new Date(existing.expires_at) <= now) return false;
  const messageText = formatTelegramTaskMessage({ projectName: project?.name ?? null, dueDate: task.due_date, workstream: task.workstream, title: task.title, description: task.description });
  const expiresAt = existing?.expires_at ?? (task.owner_approval_pending ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() : null);
  const values = { source_date: sourceDate, message_text: messageText, recipient_chat_id: recipientChatId, recipient_profile_id: task.assignee_id, status: "pending_approval", last_error: null, expires_at: expiresAt, updated_at: now.toISOString() };
  const result = existing
    ? await supabase.from("telegram_task_drafts").update(values).eq("id", existing.id).in("status", ["pending_approval", "editing", "failed"]).select("id").maybeSingle()
    : await supabase.from("telegram_task_drafts").insert({ ...values, task_id: task.id, source_date: sourceDate }).select("id").single();
  if (result.error) { if (result.error.code === "23505") return false; throw result.error; }
  if (!result.data) return false;
  try {
    const notice = `\n\nИсполнитель: <b>${escapeHtml(assignee?.full_name ?? "не назначен")}</b>` + (!recipientChatId ? "\nРабочий чат сотрудника пока не подключён. Задача сохранена только для вас." : "");
    const review = await sendTelegramMessage(ownerId, messageText + notice, draftButtons(result.data.id));
    const { error: reviewError } = await supabase.from("telegram_task_drafts").update({ review_chat_id: ownerId, review_message_id: review.message_id }).eq("id", result.data.id);
    if (reviewError) throw reviewError;
    return true;
  } catch {
    await supabase.from("telegram_task_drafts").update({ status: "failed", last_error: "Owner preview delivery failed" }).eq("id", result.data.id).eq("status", "pending_approval");
    throw new Error("Owner preview delivery failed");
  }
}

export async function createTelegramTaskPreviews(now = new Date(), options: { refreshPending?: boolean } = {}) {
  const service = createServiceClient();
  const expired = await service.rpc("expire_telegram_intake_drafts");
  if (expired.error) throw expired.error;
  if (!(await ownerChatId())) return { created: 0, skipped: "owner_not_paired" as const };
  const { data, error } = await service.from("tasks").select("id").eq("due_date", nextMoscowDate(now))
    .not("assignee_id", "is", null).not("status", "in", "(done,cancelled,paused)");
  if (error) throw error;
  let created = 0;
  for (const task of data ?? []) if (await sendTelegramTaskPreview(task.id, { ...options, now })) created++;
  return { created, skipped: null };
}

export async function resendOpenTelegramTaskPreviews(now = new Date()) {
  const ownerId = await ownerChatId();
  if (!ownerId) return 0;
  const { data, error } = await createServiceClient().from("telegram_task_drafts").select("id,task_id")
    .eq("review_chat_id", ownerId).in("status", ["pending_approval", "failed"]).neq("source_date", nextMoscowDate(now));
  if (error) throw error;
  let count = 0;
  for (const draft of data ?? []) if (await sendTelegramTaskPreview(draft.task_id, { now, refreshPending: true, existingDraftId: draft.id })) count++;
  return count;
}
