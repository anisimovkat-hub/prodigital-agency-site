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
  return `У исполнителя уже ${activeCount} задачи в работе. Новая задача запущена, но лучше вернуть одну из текущих в очередь или ожидание.`;
}

export function focusDurationSeconds(
  startedAt: string,
  endedAt: string | null,
  now = new Date(),
) {
  const end = endedAt ? new Date(endedAt) : now;
  return Math.max(0, Math.floor((end.getTime() - new Date(startedAt).getTime()) / 1_000));
}

export function findStaleActiveTaskIds({
  tasks,
  recentTaskIds,
  currentFocusTaskId,
}: {
  tasks: { id: string; status: Enums<"task_status"> | null }[];
  recentTaskIds: Iterable<string>;
  currentFocusTaskId: string | null;
}) {
  const recent = new Set(recentTaskIds);
  return tasks
    .filter(
      (task) =>
        task.status === "in_progress" &&
        task.id !== currentFocusTaskId &&
        !recent.has(task.id),
    )
    .map((task) => task.id);
}
