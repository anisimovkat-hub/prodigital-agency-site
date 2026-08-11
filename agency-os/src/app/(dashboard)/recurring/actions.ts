"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createRecurringTaskSchema,
  flattenZodErrors,
  toggleRecurringTaskSchema,
  updateRecurringScheduleSchema,
} from "@/lib/validation";

export type RecurringFormState =
  | { errors: Record<string, string[]>; success?: false }
  | { errors?: undefined; success: true }
  | undefined;

export async function createRecurringTask(
  _prevState: RecurringFormState,
  formData: FormData,
): Promise<RecurringFormState> {
  const parsed = createRecurringTaskSchema.safeParse({
    title: formData.get("title"),
    project_id: formData.get("project_id"),
    workstream: formData.get("workstream"),
    assignee_id: formData.get("assignee_id"),
    task_type: formData.get("task_type"),
    priority: formData.get("priority"),
    frequency: formData.get("frequency"),
    weekdays: formData.getAll("weekdays"),
    anchor_date: formData.get("anchor_date"),
  });

  if (!parsed.success) {
    return { errors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errors: { _root: ["Нет авторизации"] } };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "owner") {
    return {
      errors: { _root: ["Управлять повторами может только владелец"] },
    };
  }

  const { error } = await supabase.from("recurring_tasks").insert({
    title: parsed.data.title,
    project_id: parsed.data.project_id ?? null,
    workstream: parsed.data.workstream ?? null,
    assignee_id: parsed.data.assignee_id ?? null,
    creator_id: user.id,
    task_type: parsed.data.task_type,
    priority: parsed.data.priority,
    frequency: parsed.data.frequency,
    weekdays:
      parsed.data.frequency === "weekly"
        ? (parsed.data.weekdays ?? null)
        : null,
    anchor_date: parsed.data.anchor_date,
    is_active: true,
  });

  if (error) return { errors: { _root: [error.message] } };

  revalidatePath("/recurring");
  return { success: true };
}

export async function updateRecurringSchedule(
  _prevState: RecurringFormState,
  formData: FormData,
): Promise<RecurringFormState> {
  const parsed = updateRecurringScheduleSchema.safeParse({
    id: formData.get("id"),
    frequency: formData.get("frequency"),
    weekdays: formData.getAll("weekdays"),
    anchor_date: formData.get("anchor_date"),
  });

  if (!parsed.success) {
    return { errors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errors: { _root: ["Нет авторизации"] } };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "owner") {
    return {
      errors: { _root: ["Управлять повторами может только владелец"] },
    };
  }

  const { data: updated, error } = await supabase
    .from("recurring_tasks")
    .update({
      frequency: parsed.data.frequency,
      weekdays:
        parsed.data.frequency === "weekly"
          ? (parsed.data.weekdays ?? null)
          : null,
      anchor_date: parsed.data.anchor_date,
    })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();

  if (error) return { errors: { _root: [error.message] } };
  if (!updated) {
    return { errors: { _root: ["Шаблон не изменён: проверьте доступ и повторите"] } };
  }

  revalidatePath("/recurring");
  return { success: true };
}

export async function toggleRecurringTask(
  _prevState: RecurringFormState,
  formData: FormData,
): Promise<RecurringFormState> {
  const parsed = toggleRecurringTaskSchema.safeParse({
    id: formData.get("id"),
    is_active: formData.get("is_active"),
  });

  if (!parsed.success) {
    return { errors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errors: { _root: ["Нет авторизации"] } };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "owner") {
    return {
      errors: { _root: ["Управлять повторами может только владелец"] },
    };
  }

  const { data: updated, error } = await supabase
    .from("recurring_tasks")
    .update({ is_active: parsed.data.is_active })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();

  if (error) return { errors: { _root: [error.message] } };
  if (!updated) {
    return { errors: { _root: ["Шаблон не изменён: проверьте доступ и повторите"] } };
  }

  revalidatePath("/recurring");
  return { success: true };
}
