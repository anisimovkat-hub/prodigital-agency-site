"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

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
