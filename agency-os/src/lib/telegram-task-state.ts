type TelegramTaskState = {
  status: string | null;
  project_id: string | null;
  projects: { stage: string | null } | null;
};

/** Telegram edits must never resume stopped work or attach it to a new brief. */
export function isTelegramTaskOperational(task: TelegramTaskState | null): boolean {
  return !!task && !!task.status && !["done", "cancelled", "paused"].includes(task.status)
    && (!task.project_id || !!task.projects && ["active", "launching"].includes(task.projects.stage ?? ""));
}
