"use server";

import { revalidatePath } from "next/cache";

import {
  createSubtaskSchema,
  createTaskSchema,
  flattenZodErrors,
  taskAttachmentSchema,
  taskChecklistItemSchema,
  taskCommentSchema,
  updateTaskDueDateSchema,
  updateTaskSchema,
} from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

export type CreateTaskFormState =
  | { errors: Record<string, string[]> }
  | undefined;

export type UpdateTaskFormState =
  | { errors: Record<string, string[]>; success?: false }
  | { errors?: undefined; success: true; task: SavedTaskFormValues }
  | undefined;

export type SavedTaskFormValues = {
  id: string;
  title: string;
  project_id: string | null;
  assignee_id: string | null;
  status:
    | "backlog"
    | "todo"
    | "in_progress"
    | "review"
    | "done"
    | "paused"
    | "cancelled"
    | null;
  task_type:
    | "ads"
    | "creative"
    | "analytics"
    | "website"
    | "content"
    | "report"
    | "communication"
    | "other"
    | null;
  priority: "low" | "medium" | "high" | "urgent" | null;
  due_date: string | null;
  estimate_minutes: number | null;
  workstream: string | null;
  description: string | null;
  is_important: boolean | null;
  is_urgent: boolean | null;
};

export type TaskRelatedFormState =
  | { errors: string[]; success?: false }
  | { errors?: undefined; success: true }
  | undefined;

async function projectAcceptsTasks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string | null | undefined,
) {
  if (!projectId) return true;
  const { data } = await supabase
    .from("projects")
    .select("stage")
    .eq("id", projectId)
    .maybeSingle();
  return data?.stage === "active" || data?.stage === "launching";
}

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
    workstream: formData.get("workstream"),
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

  if (!(await projectAcceptsTasks(supabase, parsed.data.project_id))) {
    return {
      errors: {
        project_id: ["Проект на паузе или завершён — новые задачи отключены"],
      },
    };
  }

  const { error } = await supabase.from("tasks").insert({
    title: parsed.data.title,
    project_id: parsed.data.project_id,
    assignee_id: parsed.data.assignee_id || null,
    task_type: parsed.data.task_type,
    priority: parsed.data.priority,
    due_date: parsed.data.due_date || null,
    estimate_minutes: parsed.data.estimate_minutes,
    workstream: parsed.data.workstream || null,
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
    workstream: formData.get("workstream"),
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

  const projectOperational = await projectAcceptsTasks(
    supabase,
    parsed.data.project_id,
  );
  if (
    !projectOperational &&
    !["paused", "done", "cancelled"].includes(parsed.data.status)
  ) {
    return {
      errors: {
        status: ["Задача не может быть активной, пока проект на паузе или завершён"],
      },
    };
  }

  const { data: updatedTask, error } = await supabase
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
      workstream: parsed.data.workstream ?? null,
      description: parsed.data.description ?? null,
      is_important: parsed.data.is_important ?? false,
      is_urgent: parsed.data.is_urgent ?? false,
      completed_at:
        parsed.data.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id)
    .select(
      "id,title,project_id,assignee_id,status,task_type,priority,due_date,estimate_minutes,workstream,description,is_important,is_urgent",
    )
    .maybeSingle();

  if (error) {
    return { errors: { _root: [error.message] } };
  }
  if (!updatedTask) {
    return {
      errors: {
        _root: ["Задача не изменена: проверьте права доступа и повторите попытку"],
      },
    };
  }

  revalidateTaskViews();
  if (parsed.data.project_id) {
    revalidatePath(`/projects/${parsed.data.project_id}`);
  }

  return { success: true, task: updatedTask };
}

export type UpdateTaskDueDateResult =
  | { success: true; dueDate: string | null }
  | { success: false; error: string };

export async function updateTaskDueDate(
  taskId: string,
  dueDate: string,
): Promise<UpdateTaskDueDateResult> {
  const parsed = updateTaskDueDateSchema.safeParse({
    id: taskId,
    due_date: dueDate,
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Некорректная дата",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Нет авторизации" };

  const normalizedDueDate = parsed.data.due_date ?? null;
  const { data: updatedTask, error } = await supabase
    .from("tasks")
    .update({ due_date: normalizedDueDate })
    .eq("id", parsed.data.id)
    .select("id,due_date,project_id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!updatedTask) {
    return {
      success: false,
      error: "Задача не изменена: проверьте права доступа",
    };
  }

  revalidateTaskViews();
  if (updatedTask.project_id) {
    revalidatePath(`/projects/${updatedTask.project_id}`);
  }
  return { success: true, dueDate: updatedTask.due_date };
}

export async function createSubtask(
  _prevState: TaskRelatedFormState,
  formData: FormData,
): Promise<TaskRelatedFormState> {
  const parsed = createSubtaskSchema.safeParse({
    parent_task_id: formData.get("parent_task_id"),
    title: formData.get("title"),
    assignee_id: formData.get("assignee_id"),
    due_date: formData.get("due_date"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.issues.map((issue) => issue.message) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errors: ["Нет авторизации"] };

  // Подзадача наследует проект и направление родителя — так работают RLS и группировка
  const { data: parent } = await supabase
    .from("tasks")
    .select("project_id, workstream")
    .eq("id", parsed.data.parent_task_id)
    .maybeSingle();
  if (!parent) return { errors: ["Родительская задача не найдена"] };
  if (!(await projectAcceptsTasks(supabase, parent.project_id))) {
    return { errors: ["Проект на паузе или завершён — подзадачи отключены"] };
  }

  const { error } = await supabase.from("tasks").insert({
    title: parsed.data.title,
    parent_task_id: parsed.data.parent_task_id,
    project_id: parent.project_id,
    workstream: parent.workstream,
    assignee_id: parsed.data.assignee_id || null,
    due_date: parsed.data.due_date || null,
    creator_id: user.id,
    task_type: "other",
    priority: "medium",
  });

  if (error) return { errors: [error.message] };
  revalidateTaskViews();
  if (parent.project_id) revalidatePath(`/projects/${parent.project_id}`);
  return { success: true };
}

export async function updateTaskStatus(taskId: string, status: string) {
  if (
    ![
      "backlog",
      "todo",
      "in_progress",
      "review",
      "paused",
      "done",
      "cancelled",
    ].includes(status)
  ) {
    return { success: false as const, error: "Некорректный статус задачи" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false as const, error: "Нет авторизации" };
  }

  const { data: updatedTask, error } = await supabase
    .from("tasks")
    .update({
      status: status as never,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", taskId)
    .select("id,project_id")
    .maybeSingle();

  if (error) return { success: false as const, error: error.message };
  if (!updatedTask) {
    return {
      success: false as const,
      error: "Задача не изменена: проверьте права доступа",
    };
  }

  revalidateTaskViews();
  if (updatedTask.project_id) {
    revalidatePath(`/projects/${updatedTask.project_id}`);
  }
  return { success: true as const };
}

export async function toggleTaskDone(taskId: string, done: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { error } = await supabase
    .from("tasks")
    .update({
      status: done ? "done" : "todo",
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  if (error) return { success: false };

  revalidateTaskViews();

  return { success: true };
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
  revalidatePath("/time");
  revalidatePath("/projects");
  revalidatePath("/projects/[id]", "page");
  revalidatePath("/");
}
