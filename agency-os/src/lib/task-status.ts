import type { Enums } from "@/lib/supabase/types";

/** Terminal states that must not compete with active work in operational views. */
export function isActiveTaskStatus(
  status: Enums<"task_status"> | null,
): boolean {
  return status !== "done" && status !== "cancelled";
}
