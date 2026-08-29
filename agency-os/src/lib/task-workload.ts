import type { Enums } from "@/lib/supabase/types";

export const MAX_ACTIVE_TASKS = 3;

export function activeTaskLimitWarning({
  nextStatus,
  activeCount,
  wasActive,
}: {
  nextStatus: Enums<"task_status">;
  activeCount: number;
  wasActive: boolean;
}): string | null {
  if (nextStatus !== "in_progress" || wasActive || activeCount < MAX_ACTIVE_TASKS) {
    return null;
  }
  return `У исполнителя уже ${activeCount} задачи в работе. Новая задача запущена, но лучше вернуть одну из текущих в очередь.`;
}
