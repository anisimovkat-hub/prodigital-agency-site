import { isActiveTaskStatus } from "@/lib/task-status";
import { sortTodayTasks } from "@/lib/today-sort";
import type { Enums } from "@/lib/supabase/types";

export type DailyBriefTask = {
  id: string;
  title: string;
  assignee_id: string | null;
  project_id: string | null;
  status: Enums<"task_status"> | null;
  due_date: string | null;
  priority: Enums<"task_priority"> | null;
  is_important: boolean | null;
  is_urgent: boolean | null;
};

export type DailyBriefProfile = {
  id: string;
  full_name: string;
};

export type DelegationSuggestion<T extends DailyBriefTask> = {
  task: T;
  suggestedProfile: DailyBriefProfile;
  currentOpenTasks: number;
};

export function buildDailyBrief<T extends DailyBriefTask>({
  tasks,
  profiles,
  userId,
  today,
  allowDelegation,
}: {
  tasks: T[];
  profiles: DailyBriefProfile[];
  userId: string;
  today: string;
  allowDelegation: boolean;
}) {
  const openTasks = tasks.filter((task) => isActiveTaskStatus(task.status));
  const mine = openTasks.filter((task) => task.assignee_id === userId);
  const overdue = sortTodayTasks(
    mine.filter((task) => task.due_date && task.due_date < today),
    today,
  );
  const todayTasks = sortTodayTasks(
    mine.filter((task) => task.due_date === today),
    today,
  );
  const urgent = sortTodayTasks(
    mine.filter(
      (task) =>
        !overdue.includes(task) &&
        !todayTasks.includes(task) &&
        (task.is_urgent || task.priority === "urgent"),
    ),
    today,
  );
  const focus = uniqueTasks([...overdue, ...todayTasks, ...urgent, ...sortTodayTasks(mine, today)]).slice(
    0,
    3,
  );

  const delegationSuggestions = allowDelegation
    ? buildDelegationSuggestions(openTasks, profiles, userId, focus)
    : [];

  return { overdue, today: todayTasks, urgent, focus, delegationSuggestions };
}

function buildDelegationSuggestions<T extends DailyBriefTask>(
  openTasks: T[],
  profiles: DailyBriefProfile[],
  userId: string,
  focus: T[],
): DelegationSuggestion<T>[] {
  const capacity = profiles
    .filter((profile) => profile.id !== userId)
    .map((profile) => ({
      profile,
      open: openTasks.filter((task) => task.assignee_id === profile.id).length,
    }))
    .filter((item) => item.open < 3)
    .sort(
      (a, b) =>
        a.open - b.open ||
        a.profile.full_name.localeCompare(b.profile.full_name, "ru"),
    );
  if (capacity.length === 0) return [];

  const focusIds = new Set(focus.map((task) => task.id));
  const candidates = sortTodayTasks(
    openTasks.filter(
      (task) =>
        task.assignee_id === userId &&
        task.project_id !== null &&
        !focusIds.has(task.id),
    ),
  ).slice(0, 3);

  return candidates.map((task, index) => {
    const destination = capacity[index % capacity.length];
    destination.open += 1;
    capacity.sort(
      (a, b) =>
        a.open - b.open ||
        a.profile.full_name.localeCompare(b.profile.full_name, "ru"),
    );
    return {
      task,
      suggestedProfile: destination.profile,
      currentOpenTasks: destination.open - 1,
    };
  });
}

function uniqueTasks<T extends DailyBriefTask>(tasks: T[]) {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}
