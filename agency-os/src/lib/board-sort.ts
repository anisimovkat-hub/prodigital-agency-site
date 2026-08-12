import { todayISO } from "@/lib/format";
import type { Enums } from "@/lib/supabase/types";

export const BOARD_COLUMNS: Enums<"task_status">[] = [
  "todo",
  "in_progress",
  "paused",
  "review",
  "done",
];

export type BoardSortableTask = {
  due_date: string | null;
  priority: Enums<"task_priority"> | null;
  is_important: boolean | null;
  is_urgent: boolean | null;
};

const PRIORITY_ORDER: Record<Enums<"task_priority">, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function urgencyBucket(task: BoardSortableTask, today: string): number {
  if (task.due_date && task.due_date < today) return 0;
  if (task.due_date === today) return 1;
  if (task.is_urgent || task.priority === "urgent") return 2;
  return 3;
}

/**
 * Рабочая очередь доски: просрочено → сегодня → срочно → важно →
 * приоритет → ближайший дедлайн. Равные задачи сохраняют исходный порядок.
 */
export function sortBoardTasks<T extends BoardSortableTask>(
  tasks: T[],
  today = todayISO(),
): T[] {
  return [...tasks].sort((a, b) => {
    const urgencyDiff = urgencyBucket(a, today) - urgencyBucket(b, today);
    if (urgencyDiff !== 0) return urgencyDiff;

    const importanceDiff = Number(Boolean(b.is_important)) - Number(Boolean(a.is_important));
    if (importanceDiff !== 0) return importanceDiff;

    const priorityDiff =
      PRIORITY_ORDER[a.priority ?? "medium"] -
      PRIORITY_ORDER[b.priority ?? "medium"];
    if (priorityDiff !== 0) return priorityDiff;

    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
}
