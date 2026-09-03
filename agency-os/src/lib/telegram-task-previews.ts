import { createServiceClient } from "@/lib/supabase/service";
import { formatTelegramTaskMessage, nextMoscowDate } from "@/lib/telegram-task-message";
import { sendTelegramMessage } from "@/lib/telegram";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  workstream: string | null;
  assignee_id: string | null;
  projects: { name: string } | null;
  assignee: { full_name: string } | null;
};

async function ownerChatId(): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("telegram_bot_settings")
    .select("setting_value")
    .eq("setting_key", "owner_chat_id")
    .maybeSingle();
  return data?.setting_value ?? null;
}

export async function createTelegramTaskPreviews(now = new Date()) {
  const supabase = createServiceClient();
  const recipientDate = nextMoscowDate(now);
  const ownerId = await ownerChatId();
  if (!ownerId) return { created: 0, skipped: "owner_not_paired" as const };

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id,title,description,due_date,workstream,assignee_id,projects(name),assignee:profiles!tasks_assignee_id_fkey(full_name)")
    .eq("due_date", recipientDate)
    .not("assignee_id", "is", null)
    .not("status", "in", "(done,cancelled,paused)");
  if (tasksError) throw tasksError;

  let created = 0;
  for (const rawTask of (tasks ?? []) as unknown as TaskRow[]) {
    if (!rawTask.assignee_id || !rawTask.due_date) continue;
    const { data: directBinding } = await supabase
      .from("telegram_chat_bindings")
      .select("chat_id,profile_id")
      .eq("profile_id", rawTask.assignee_id)
      .eq("is_active", true)
      .maybeSingle();
    let binding = directBinding;
    // Existing chats may have been connected before a profile's name was made
    // unambiguous. A single title match is safe and avoids a manual chat-ID setup.
    if (!binding && rawTask.assignee?.full_name) {
      const firstName = rawTask.assignee.full_name.trim().split(/\s+/)[0]?.toLocaleLowerCase("ru-RU");
      const { data: titleCandidates } = await supabase
        .from("telegram_chat_bindings")
        .select("chat_id,profile_id,chat_title")
        .eq("is_active", true);
      const matchingTitle = (titleCandidates ?? []).filter((candidate) =>
        firstName && candidate.chat_title?.toLocaleLowerCase("ru-RU").includes(firstName),
      );
      if (matchingTitle.length === 1) {
        binding = { chat_id: matchingTitle[0].chat_id, profile_id: rawTask.assignee_id };
      }
    }
    if (!binding) continue;

    const { data: existing } = await supabase
      .from("telegram_task_drafts")
      .select("id,status")
      .eq("task_id", rawTask.id)
      .eq("source_date", recipientDate)
      .maybeSingle();
    if (existing?.status && existing.status !== "failed") continue;

    const messageText = formatTelegramTaskMessage({
      projectName: rawTask.projects?.name ?? null,
      dueDate: rawTask.due_date,
      workstream: rawTask.workstream,
      title: rawTask.title,
      description: rawTask.description,
    });
    const draft = existing
      ? await supabase
          .from("telegram_task_drafts")
          .update({ message_text: messageText, recipient_chat_id: binding.chat_id, status: "pending_approval", last_error: null })
          .eq("id", existing.id)
          .select("id")
          .single()
      : await supabase
          .from("telegram_task_drafts")
          .insert({ task_id: rawTask.id, source_date: recipientDate, recipient_chat_id: binding.chat_id, recipient_profile_id: binding.profile_id, message_text: messageText })
          .select("id")
          .single();
    if (draft.error || !draft.data) throw draft.error ?? new Error("Could not create Telegram draft.");

    try {
      const review = await sendTelegramMessage(
        ownerId,
        `Проверка перед отправкой сотруднику:\n\n${messageText}`,
        [[
          { text: "Отправить сотруднику", callback_data: `tg:send:${draft.data.id}` },
          { text: "Внести правки", callback_data: `tg:edit:${draft.data.id}` },
        ]],
      );
      await supabase
        .from("telegram_task_drafts")
        .update({ review_chat_id: ownerId, review_message_id: review.message_id })
        .eq("id", draft.data.id);
      created += 1;
    } catch (error) {
      await supabase
        .from("telegram_task_drafts")
        .update({ status: "failed", last_error: error instanceof Error ? error.message.slice(0, 500) : "Telegram send failed" })
        .eq("id", draft.data.id);
      throw error;
    }
  }
  return { created, skipped: null };
}
