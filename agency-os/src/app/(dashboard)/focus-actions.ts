"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type FocusActionResult =
  | { success: true }
  | { success: false; error: string };

export async function startTaskFocus(taskId: string): Promise<FocusActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_task_focus", {
    p_task_id: taskId,
  });
  if (error) return { success: false, error: readableFocusError(error.message) };
  revalidateFocusViews();
  return { success: true };
}

export async function stopTaskFocus(): Promise<FocusActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("stop_task_focus", {
    p_reason: "stopped",
  });
  if (error) return { success: false, error: readableFocusError(error.message) };
  revalidateFocusViews();
  return { success: true };
}

export async function waitForAi(taskId: string): Promise<FocusActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_task_ai_wait", {
    p_task_id: taskId,
  });
  if (error) return { success: false, error: readableFocusError(error.message) };
  revalidateFocusViews();
  return { success: true };
}

function revalidateFocusViews() {
  revalidatePath("/", "layout");
  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/brief");
  revalidatePath("/time");
}

function readableFocusError(message: string) {
  if (message.includes("unavailable for focus")) {
    return "Можно начать фокус только на своей доступной активной задаче.";
  }
  if (message.includes("unavailable")) {
    return "Задача недоступна или уже завершена.";
  }
  return message;
}
