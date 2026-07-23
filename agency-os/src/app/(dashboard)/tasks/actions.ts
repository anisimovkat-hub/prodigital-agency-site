"use server";

import { revalidatePath } from "next/cache";

import {
  createTaskSchema,
  flattenZodErrors,
  taskAttachmentSchema,
  taskChecklistItemSchema,
  taskCommentSchema,
  updateTaskSchema,
} from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

export type CreateTaskFormState =
  | { errors: Record<string, string[]> }
  | undefined;

export type UpdateTaskFormState =
  | { errors: Record<string, string[]>; success?: false }
  | { errors?: undefined; success: true }
  | undefined;

export type TaskRelatedFormState =
  | { errors: string[]; success?: false }
  | { errors?: undefined; success: true }
  | undefined;

export async function createTask(
  _prevState: CreateTaskFormState,
  formData: FormData,
): Promise<CreateTaskFormState> {
  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    project_id: formData.get("project_id"),
    assignee_id: formData.get("assignee_id"),
    task_type: formData.get("task_type"),
    priority: formData.get("priority"),
    due_date: formData.get("due_date"),
    estimate_minutes: formData.get("estimate_hours"),
    description: formData.get("description"),
    is_important: formData.get("is_important") === "on",
    is_urgent: formData.get("is_urgent") === "on",
  });

  if (!parsed.success) {
    return { errors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("tasks").insert({
    title: parsed.data.title,
    project_id: parsed.data.project_id,
    assignee_id: parsed.data.assignee_id || null,
    task_type: parsed.data.task_type,
    priority: parsed.data.priority,
    due_date: parsed.data.due_date || null,
    estimate_minutes: parsed.data.estimate_minutes,
    description: parsed.data.description || null,
    is_important: parsed.data.is_important ?? false,
    is_urgent: parsed.data.is_urgent ?? false,
    creator_id: user?.id ?? null,
  });

  if (error) {
    return { errors: { title: [error.message] } };
  }

  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/");
  revalidatePath(`/projects/${parsed.data.project_id}`);

  return undefined;
}

export async function updateTask(
  _prevState: UpdateTaskFormState,
  formData: FormData,
): Promise<UpdateTaskFormState> {
  const parsed = updateTaskSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    project_id: formData.get("project_id"),
    assignee_id: formData.get("assignee_id"),
    status: formData.get("status"),
    task_type: formData.get("task_type"),
    priority: formData.get("priority"),
    due_date: formData.get("due_date"),
    estimate_minutes: formData.get("estimate_hours"),
    description: formData.get("description"),
    is_important: formData.get("is_important") === "on",
    is_urgent: formData.get("is_urgent") === "on",
  });

  if (!parsed.success) {
    return { errors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errors: { _root: ["Нет авторизации"] } };

  const { error } = await supabase
    .from("tasks")
    .update({
      title: parsed.data.title,
      project_id: parsed.data.project_id ?? null,
      assignee_id: parsed.data.assignee_id ?? null,
      status: parsed.data.status,
      task_type: parsed.data.task_type,
      priority: parsed.data.priority,
      due_date: parsed.data.due_date ?? null,
      estimate_minutes: parsed.data.estimate_minutes,
      description: parsed.data.description ?? null,
      is_important: parsed.data.is_important ?? false,
      is_urgent: parsed.data.is_urgent ?? false,
      completed_at:
        parsed.data.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id);

  if (error) {
    return { errors: { _root: [error.message] } };
  }

  revalidateTaskViews();
  if (parsed.data.project_id) {
    revalidatePath(`/projects/${parsed.data.project_id}`);
  }

  return { success: true };
}

export async function updateTaskStatus(taskId: string, status: string) {
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({
      status: status as never,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/personal");
  revalidatePath("/");
}

export async function toggleTaskDone(taskId: string, done: boolean) {
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({
      status: done ? "done" : "todo",
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  revalidatePath("/today");
  revalidatePath("/tasks");
  revalidatePath("/week");
  revalidatePath("/");
}

export async function toggleChecklistItem(itemId: string, isDone: boolean) {
  const supabase = await createClient();
  await supabase
    .from("task_checklist_items")
    .update({ is_done: isDone })
    .eq("id", itemId);

  revalidateTaskViews();
}

export async function addChecklistItem(
  _prevState: TaskRelatedFormState,
  formData: FormData,
): Promise<TaskRelatedFormState> {
  const parsed = taskChecklistItemSchema.safeParse({
    task_id: formData.get("task_id"),
    title: formData.get("title"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.issues.map((issue) => issue.message) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errors: ["Нет авторизации"] };

  const { data: lastItem } = await supabase
    .from("task_checklist_items")
    .select("position")
    .eq("task_id", parsed.data.task_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("task_checklist_items").insert({
    task_id: parsed.data.task_id,
    title: parsed.data.title,
    position: (lastItem?.position ?? -1) + 1,
  });

  if (error) return { errors: [error.message] };
  revalidateTaskViews();
  return { success: true };
}

export async function addTaskComment(
  _prevState: TaskRelatedFormState,
  formData: FormData,
): Promise<TaskRelatedFormState> {
  const parsed = taskCommentSchema.safeParse({
    task_id: formData.get("task_id"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.issues.map((issue) => issue.message) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errors: ["Нет авторизации"] };

  const { error } = await supabase.from("task_comments").insert({
    task_id: parsed.data.task_id,
    author_id: user.id,
    body: parsed.data.body,
  });

  if (error) return { errors: [error.message] };
  revalidateTaskViews();
  return { success: true };
}

export async function addTaskAttachment(
  _prevState: TaskRelatedFormState,
  formData: FormData,
): Promise<TaskRelatedFormState> {
  const parsed = taskAttachmentSchema.safeParse({
    task_id: formData.get("task_id"),
    title: formData.get("title"),
    url: formData.get("url"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.issues.map((issue) => issue.message) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errors: ["Нет авторизации"] };

  const { error } = await supabase.from("task_attachments").insert({
    task_id: parsed.data.task_id,
    title: parsed.data.title ?? null,
    url: parsed.data.url,
  });

  if (error) return { errors: [error.message] };
  revalidateTaskViews();
  return { success: true };
}

export async function updateTaskAttachment(
  _prevState: TaskRelatedFormState,
  formData: FormData,
): Promise<TaskRelatedFormState> {
  const parsed = taskAttachmentSchema.safeParse({
    task_id: formData.get("task_id"),
    attachment_id: formData.get("attachment_id"),
    title: formData.get("title"),
    url: formData.get("url"),
  });
  if (!parsed.success || !parsed.data.attachment_id) {
    return {
      errors: parsed.success
        ? ["Некорректное вложение"]
        : parsed.error.issues.map((issue) => issue.message),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errors: ["Нет авторизации"] };

  const { error } = await supabase
    .from("task_attachments")
    .update({
      title: parsed.data.title ?? null,
      url: parsed.data.url,
    })
    .eq("id", parsed.data.attachment_id)
    .eq("task_id", parsed.data.task_id);

  if (error) return { errors: [error.message] };
  revalidateTaskViews();
  return { success: true };
}

export async function deleteTaskAttachment(
  attachmentId: string,
  taskId: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("task_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("task_id", taskId);

  revalidateTaskViews();
}

function revalidateTaskViews() {
  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/week");
  revalidatePath("/personal");
  revalidatePath("/");
}
