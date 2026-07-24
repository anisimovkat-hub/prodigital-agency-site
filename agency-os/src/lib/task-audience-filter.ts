export const TASK_AUDIENCE_VALUES = [
  "all",
  "mine",
  "personal",
  "team",
] as const;

export type TaskAudience = (typeof TASK_AUDIENCE_VALUES)[number];

type AudienceTask = {
  assignee_id: string | null;
  project_id: string | null;
};

type AudienceFilter = {
  userId: string;
  who?: string;
  assigneeId?: string;
};

export function filterTasksByAudience<T extends AudienceTask>(
  tasks: T[],
  { userId, who, assigneeId }: AudienceFilter,
): T[] {
  if (assigneeId) {
    return tasks.filter((task) => task.assignee_id === assigneeId);
  }

  switch (who) {
    case "mine":
      return tasks.filter((task) => task.assignee_id === userId);
    case "personal":
      return tasks.filter((task) => task.project_id === null);
    case "team":
      return tasks.filter(
        (task) => !!task.assignee_id && task.assignee_id !== userId,
      );
    default:
      return tasks;
  }
}
