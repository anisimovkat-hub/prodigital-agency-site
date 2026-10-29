import { nextIntakeQuestion } from "@/lib/task-intake-flow";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json, Tables } from "@/lib/supabase/types";
import { answerCallbackQuery, sendTelegramMessage } from "@/lib/telegram";
import { sendTelegramTaskPreview } from "@/lib/telegram-task-previews";
import { isTelegramTaskOperational } from "@/lib/telegram-task-state";
import { matchIntakeEntities, parseIntakeDeadline, parseIntakeTask, parseIntakeEdit, splitIntakeTasks, uniqueExactIntakeMatch, type IntakeProject, type IntakeProfile, type ParsedIntakeTask } from "@/lib/task-intake-parser";

type Session = Tables<"telegram_task_intakes">;
type Choice = { id: string; label: string };
type Catalog = { projects: IntakeProject[]; profiles: IntakeProfile[] };
const asJson = (value: unknown) => value as Json;
const itemsOf = (session: Session) => session.items as unknown as ParsedIntakeTask[];
const choicesOf = (session: Session) => session.choices as unknown as Choice[];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function catalog(): Promise<Catalog> {
  const service = createServiceClient();
  const results = await Promise.all([
    service.from("projects").select("id,name,aliases,stage,responsible_id,clients(name)").order("name").limit(500),
    service.from("profiles").select("id,full_name,aliases").eq("is_active", true).order("full_name").limit(100),
    service.from("project_members").select("project_id,profile_id").limit(2000),
    service.from("project_responsibles").select("project_id,profile_id").limit(2000),
  ]);
  for (const result of results) if (result.error) throw result.error;
  const [projects, profiles, members, responsibles] = results;
  return {
    projects: (projects.data ?? []).map((p) => ({ id: p.id, name: p.name, aliases: p.aliases, stage: p.stage,
      clientName: (p.clients as { name: string } | null)?.name,
      memberIds: [...new Set([p.responsible_id, ...(members.data ?? []).filter((m) => m.project_id === p.id).map((m) => m.profile_id), ...(responsibles.data ?? []).filter((m) => m.project_id === p.id).map((m) => m.profile_id)].filter((id): id is string => Boolean(id)))],
    })),
    profiles: (profiles.data ?? []).map((p) => ({ id: p.id, name: p.full_name, aliases: p.aliases })),
  };
}

async function loadSession(id: string, chatId: string): Promise<Session> {
  const { data, error } = await createServiceClient().from("telegram_task_intakes").select("*").eq("id", id).eq("chat_id", chatId).single();
  if (error) throw error;
  return data;
}

async function changeSession(session: Session, update: {
  items?: Json; current_index?: number; pending_field?: string | null; choices?: Json; status?: string; message_ids?: number[];
}): Promise<Session | null> {
  const { data, error } = await createServiceClient().from("telegram_task_intakes")
    .update({ ...update, revision: session.revision + 1, updated_at: new Date().toISOString() })
    .eq("id", session.id).eq("revision", session.revision).eq("status", "pending").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

async function ask(session: Session, field: string, choices: Choice[], prompt: string) {
  const updated = await changeSession(session, { pending_field: field, choices: asJson(choices) });
  if (!updated) return;
  const buttons = choices.map((choice, i) => [{ text: choice.label.slice(0, 60), callback_data: `ji:${session.id}:${updated.revision}:${i}` }]);
  buttons.push([{ text: "Отменить", callback_data: `ji:${session.id}:${updated.revision}:cancel` }]);
  await sendTelegramMessage(session.chat_id, prompt, buttons);
}

async function advance(initial: Session, data: Catalog) {
  let session = initial;
  while (session.status === "pending" && session.current_index < itemsOf(session).length) {
    const item = itemsOf(session)[session.current_index];
    const question = nextIntakeQuestion(item, data);
    if (question) { await ask(session, question.field, question.choices, question.prompt); return; }
    if (session.edit_draft_id && !item.taskId) {
      // A clarification/retry may outlive the task's operational state. Re-read
      // immediately before a new edit RPC, not only when conversation starts.
      // Once taskId is persisted the RPC is read-only/idempotent: its draft may
      // already be pending_approval after a successful prior owner preview.
      const service = createServiceClient();
      const draft = await service.from("telegram_task_drafts").select("task_id")
        .eq("id", session.edit_draft_id).eq("review_chat_id", session.chat_id).eq("status", "editing").maybeSingle();
      if (draft.error) throw draft.error;
      if (!draft.data) throw new Error("Editing context is no longer available");
      const target = await service.from("tasks").select("status,project_id,projects(stage)").eq("id", draft.data.task_id).maybeSingle();
      if (target.error) throw target.error;
      if (!isTelegramTaskOperational(target.data)) throw new Error("Editing target is no longer operational");
    }
    const { data: taskId, error } = await createServiceClient().rpc("commit_telegram_intake_item", { p_intake_id: session.id, p_index: session.current_index });
    if (error) throw error;
    if (typeof taskId !== "string" || !UUID.test(taskId)) throw new Error("Task commit was not confirmed");
    const previewed = await sendTelegramTaskPreview(taskId, { refreshPending: true, ...(session.edit_draft_id ? { existingDraftId: session.edit_draft_id } : {}) });
    // A skipped preview is not a delivered owner approval. Keep the persisted
    // taskId/current item for an idempotent retry, rather than silently finishing.
    if (previewed !== true) throw new Error("Owner task preview was not confirmed");
    session = await loadSession(session.id, session.chat_id);
    const items = itemsOf(session);
    items[session.current_index].previewed = true;
    const next = session.current_index + 1;
    const changed = await changeSession(session, { items: asJson(items), current_index: next, pending_field: null, choices: [], status: next >= items.length ? "complete" : "pending" });
    if (!changed) return;
    session = changed;
  }
}

async function continueWithText(session: Session, messageId: number, text: string, data: Catalog) {
  const items = itemsOf(session), item = items[session.current_index];
  if (session.pending_field === "project" || session.pending_field === "project_search") {
    item.projectId = uniqueExactIntakeMatch(matchIntakeEntities(text, data.projects));
    if (!item.projectId) item.projectQuery = text;
  } else if (session.pending_field === "assignee") {
    item.assigneeId = uniqueExactIntakeMatch(matchIntakeEntities(text, data.profiles));
  } else if (session.pending_field === "deadline") {
    const deadline = parseIntakeDeadline(text); item.dueDate = deadline.date; item.deadlineKnown = deadline.known;
  } else if (session.pending_field === "title") {
    item.title = text.trim().slice(0, 200);
  }
  const result = await createServiceClient().rpc("apply_telegram_intake_reply", { p_intake_id: session.id, p_message_id: messageId, p_revision: session.revision, p_items: asJson(items) });
  if (result.error) throw result.error;
  if (result.data) await advance(await loadSession(result.data, session.chat_id), data);
  else await sendTelegramMessage(session.chat_id, "Вопрос уже изменился. Ответьте, пожалуйста, на последний вопрос ещё раз.");
}

/** Caller must authenticate the owner's private sender/chat before invoking. */
export async function handleTelegramTaskText(chatId: string, messageId: number, text: string) {
  if (text.length > 12000) { await sendTelegramMessage(chatId, "Пришлите сообщение объёмом до 12 000 знаков."); return; }
  const service = createServiceClient();
  const data = await catalog();
  const { data: duplicate, error: duplicateError } = await service.from("telegram_intake_messages").select("intake_id").eq("chat_id", chatId).eq("message_id", messageId).maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate) { await advance(await loadSession(duplicate.intake_id, chatId), data); return; }
  const { data: openRow, error: openError } = await service.from("telegram_task_intakes").select("*").eq("chat_id", chatId).eq("status", "pending").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (openError) throw openError;
  let open = openRow;
  const { data: editingRow, error: editError } = await service.from("telegram_task_drafts").select("id,task_id").eq("review_chat_id", chatId).eq("status", "editing").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (editError) throw editError;
  let editing = editingRow;
  let editableTask: Pick<Tables<"tasks">, "project_id" | "assignee_id" | "title" | "description" | "due_date"> | null = null;
  if (editing) {
    const { data: task, error } = await service.from("tasks").select("project_id,assignee_id,title,description,due_date,status,projects(stage)").eq("id", editing.task_id).maybeSingle();
    if (error) throw error;
    if (isTelegramTaskOperational(task)) editableTask = task;
    else {
      // Close only the stale conversational context. The cancel RPC would also
      // cancel an unapproved task; it must not be used for this cleanup.
      const released = await service.from("telegram_task_drafts")
        .update({ status: "cancelled", last_error: "Editing context closed: task is not operational", updated_at: new Date().toISOString() })
        .eq("id", editing.id).eq("task_id", editing.task_id).eq("review_chat_id", chatId).eq("status", "editing")
        .select("id").maybeSingle();
      if (released.error) throw released.error;
      if (!released.data) throw new Error("Editing context changed before release");
      if (open?.edit_draft_id === editing.id) {
        const cancelled = await changeSession(open, { status: "cancelled" });
        if (!cancelled) throw new Error("Editing session changed before release");
        open = null;
      }
      editing = null;
    }
  }
  if (open?.pending_field) { await continueWithText(open, messageId, text, data); return; }
  let items: ParsedIntakeTask[];
  if (editing && editableTask) {
    items = [parseIntakeEdit(text, { source: "", projectId: editableTask.project_id, assigneeId: editableTask.assignee_id, title: editableTask.title, description: editableTask.description, dueDate: editableTask.due_date, deadlineKnown: true }, data.projects, data.profiles)];
  } else {
    const sources = splitIntakeTasks(text);
    if (sources.length > 20 || text.length > 12000) { await sendTelegramMessage(chatId, "Пришлите до 20 задач в одном сообщении, объёмом до 12 000 знаков."); return; }
    items = sources.map((source) => parseIntakeTask(source, data.projects, data.profiles));
  }
  if (!items.length) return;
  const { data: sessionId, error } = await service.rpc("start_telegram_task_intake", { p_chat_id: chatId, p_message_id: messageId, p_items: asJson(items), p_edit_draft_id: editing?.id ?? undefined });
  if (error) throw error;
  await advance(await loadSession(sessionId, chatId), data);
}

export async function handleTelegramIntakeChoice(chatId: string, callbackId: string, callbackData: string) {
  const match = callbackData.match(/^ji:([0-9a-f-]{36}):(\d+):(\d+|cancel)$/);
  if (!match) return;
  const session = await loadSession(match[1], chatId);
  if (session.status !== "pending" || session.revision !== Number(match[2])) { await answerCallbackQuery(callbackId, "Этот вопрос уже обработан."); return; }
  if (match[3] === "cancel") {
    const cancelled = await changeSession(session, { status: "cancelled" });
    if (cancelled?.edit_draft_id) {
      const result = await createServiceClient().rpc("cancel_telegram_task_draft", { p_draft_id: cancelled.edit_draft_id, p_owner_chat_id: chatId });
      if (result.error) throw result.error;
    }
    await answerCallbackQuery(callbackId, "Отменено"); await sendTelegramMessage(chatId, "Эта задача отменена. Сотруднику ничего не отправлено."); return;
  }
  const choice = choicesOf(session)[Number(match[3])];
  if (!choice) { await answerCallbackQuery(callbackId, "Выберите одну из кнопок."); return; }
  const data = await catalog();
  if (choice.id === "other") {
    await answerCallbackQuery(callbackId);
    if (session.pending_field === "assignee") await ask(session, "assignee", data.profiles.map((p) => ({ id: p.id, label: p.name })), "Выберите сотрудника:");
    else await ask(session, "project_search", [], "Напишите название проекта следующим сообщением.");
    return;
  }
  const items = itemsOf(session), item = items[session.current_index];
  if (session.pending_field === "project") item.projectId = choice.id;
  else if (session.pending_field === "assignee") item.assigneeId = choice.id;
  else if (session.pending_field === "deadline") { item.dueDate = choice.id === "none" ? null : choice.id; item.deadlineKnown = true; }
  else return;
  const changed = await changeSession(session, { items: asJson(items), pending_field: null, choices: [] });
  await answerCallbackQuery(callbackId);
  if (changed) await advance(changed, data);
}

export async function queueTelegramVoice(chatId: string, messageId: number, voice: { file_id: string; file_unique_id: string }) {
  const { error } = await createServiceClient().from("telegram_voice_queue").upsert({ chat_id: chatId, source_message_id: messageId, file_id: voice.file_id, file_unique_id: voice.file_unique_id }, { onConflict: "chat_id,source_message_id", ignoreDuplicates: true });
  if (error) throw error;
  await sendTelegramMessage(chatId, "Пришлите текстом через Wispr — голосовые подключим на сервере");
}
