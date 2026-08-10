import type { Enums } from "@/lib/supabase/types";

export const PERSONAL_COMPLETED_DELETE_AFTER_DUE_DAYS = 2;

type PersonalTaskOrderable = {
  status: Enums<"task_status"> | null;
  due_date: string | null;
  created_at: string | null;
};

export function personalCompletedDeleteCutoff(today: string): string {
  const cutoff = new Date(`${today}T00:00:00.000Z`);
  cutoff.setUTCDate(
    cutoff.getUTCDate() - PERSONAL_COMPLETED_DELETE_AFTER_DUE_DAYS,
  );
  return cutoff.toISOString().slice(0, 10);
}

export function isExpiredPersonalCompletedTask(
  task: Pick<PersonalTaskOrderable, "status" | "due_date">,
  today: string,
): boolean {
  return (
    task.status === "done" &&
    task.due_date !== null &&
    task.due_date <= personalCompletedDeleteCutoff(today)
  );
}

export function sortPersonalTasks<T extends PersonalTaskOrderable>(
  tasks: T[],
): T[] {
  return [...tasks].sort((a, b) => {
    const doneDiff = Number(a.status === "done") - Number(b.status === "done");
    if (doneDiff !== 0) return doneDiff;

    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.status === "done"
        ? b.due_date.localeCompare(a.due_date)
        : a.due_date.localeCompare(b.due_date);
    }

    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });
}
