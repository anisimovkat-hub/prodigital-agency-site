"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

// Переключение проекта: закрываем текущий интервал и открываем новый.
export async function startTimer(formData: FormData) {
  const rawProject = formData.get("project_id");
  const projectId =
    typeof rawProject === "string" && rawProject && rawProject !== "none"
      ? rawProject
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const now = new Date().toISOString();
  await supabase
    .from("time_entries")
    .update({ ended_at: now })
    .eq("user_id", user.id)
    .is("ended_at", null);

  await supabase.from("time_entries").insert({
    user_id: user.id,
    project_id: projectId,
    started_at: now,
  });

  revalidatePath("/", "layout");
}

// Остановка: закрываем текущий интервал.
export async function stopTimer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("ended_at", null);

  revalidatePath("/", "layout");
}
