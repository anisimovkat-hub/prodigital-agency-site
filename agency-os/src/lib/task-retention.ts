export const COMPLETED_TASK_VISIBLE_DAYS = 30;
export const COMPLETED_TASK_DELETE_DAYS = 60;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function completedTasksVisibleSince(now = new Date()) {
  return new Date(now.getTime() - COMPLETED_TASK_VISIBLE_DAYS * DAY_IN_MS);
}

export function completedTasksDeleteBefore(now = new Date()) {
  return new Date(now.getTime() - COMPLETED_TASK_DELETE_DAYS * DAY_IN_MS);
}
