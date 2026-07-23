"use server";

import { revalidatePath } from "next/cache";

import { createTaskSchema, flattenZodErrors } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

export type CreateTaskFormState =
  | { errors: Record<string, string[]> }
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

  revalidatePath("/tasks");
}
