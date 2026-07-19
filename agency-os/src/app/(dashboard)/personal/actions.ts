"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { TASK_PRIORITY_VALUES } from "@/lib/validation";
import { flattenZodErrors } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

const personalTaskSchema = z.object({
  title: z.string().trim().min(1, "Укажите название задачи"),
  priority: z.enum(TASK_PRIORITY_VALUES),
  due_date: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().optional(),
  ),
  description: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().optional(),
  ),
});

export type PersonalTaskFormState =
  | { errors: Record<string, string[]> }
  | undefined;

export async function createPersonalTask(
  _prevState: PersonalTaskFormState,
  formData: FormData,
): Promise<PersonalTaskFormState> {
  const parsed = personalTaskSchema.safeParse({
    title: formData.get("title"),
    priority: formData.get("priority"),
    due_date: formData.get("due_date"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { errors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errors: { title: ["Нет авторизации"] } };

  const { error } = await supabase.from("tasks").insert({
    title: parsed.data.title,
    project_id: null,
    creator_id: user.id,
    assignee_id: user.id,
    priority: parsed.data.priority,
    task_type: "other",
    due_date: parsed.data.due_date || null,
    description: parsed.data.description || null,
  });

  if (error) {
    return { errors: { title: [error.message] } };
  }

  revalidatePath("/personal");
  revalidatePath("/board");
  revalidatePath("/today");

  return undefined;
}
