export type TaskView = "day" | "weeks" | "list";

export const DEFAULT_TASK_VIEW: TaskView = "day";
export const TASK_VIEW_STORAGE_KEY = "agency-os:task-view";

export function normalizeTaskView(value: string | null | undefined): TaskView {
  return value === "day" || value === "weeks" || value === "list"
    ? value
    : DEFAULT_TASK_VIEW;
}

export function taskViewForPath(pathname: string): TaskView {
  if (pathname.startsWith("/week")) return "weeks";
  if (pathname.startsWith("/tasks")) return "list";
  return "day";
}

export function taskViewHref(
  view: TaskView,
  audience?: { who?: string | null; assignee?: string | null },
): string {
  const pathname =
    view === "day" ? "/today" : view === "weeks" ? "/week" : "/tasks";
  const params = new URLSearchParams();
  if (audience?.who) params.set("who", audience.who);
  if (audience?.assignee) params.set("assignee", audience.assignee);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}
