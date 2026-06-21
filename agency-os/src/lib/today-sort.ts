import { isDueToday, todayISO } from "@/lib/format";
import type { Enums } from "@/lib/supabase/types";

export type TodaySortableTask = {
  due_date: string | null;
  priority: Enums<"task_priority"> | null;
  is_important: boolean | null;
};

/**
 * Бакеты приоритета для страницы "Сегодня":
 * 1. просрочено, 2. дедлайн сегодня, 3. urgent, 4. important, 5. high, 6. остальное.
 */
export function taskBucket(task: TodaySortableTask, today = todayISO()): number {
  if (task.due_date && task.due_date < today) return 1;
  if (isDueToday(task.due_date)) return 2;
  if (task.priority === "urgent") return 3;
  if (task.is_important) return 4;
  if (task.priority === "high") return 5;
  return 6;
}

export function sortTodayTasks<T extends TodaySortableTask>(
  tasks: T[],
  today = todayISO(),
): T[] {
  return [...tasks].sort((a, b) => {
    const bucketDiff = taskBucket(a, today) - taskBucket(b, today);
    if (bucketDiff !== 0) return bucketDiff;
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
}
