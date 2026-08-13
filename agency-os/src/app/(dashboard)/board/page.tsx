import { KanbanBoard, type BoardTask } from "@/app/(dashboard)/board/kanban-board";
import { TaskDrawer } from "@/app/(dashboard)/tasks/task-drawer";
import {
  isOperationalProject,
  isTaskOperational,
} from "@/lib/project-lifecycle";
import { createClient } from "@/lib/supabase/server";
import { sortProjectsForDisplay } from "@/lib/project-order";
import { sumRawTaskTime } from "@/lib/time-analytics";

type BoardSearchParams = {
  project?: string;
  assignee?: string;
  task?: string;
};

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<BoardSearchParams>;
}) {
  const filters = await searchParams;
  const supabase = await createClient();
  const timeSnapshotAt = new Date();

  const [
    { data: tasks },
    { data: projects },
    { data: profiles },
    { data: timeEntries },
    { data: activeFocusSessions },
  ] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id,project_id,title,status,priority,due_date,is_important,is_urgent,project:projects(id,name,stage), assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
        )
        .neq("status", "cancelled")
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name,stage"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
      supabase
        .from("task_time_entries")
        .select("task_id,started_at,ended_at"),
      supabase
        .from("focus_sessions")
        .select("task_id,user_id")
        .is("ended_at", null),
    ]);
  const trackedSeconds = sumRawTaskTime(
    timeEntries ?? [],
    timeSnapshotAt,
  );
  const operationalTasks = (tasks ?? []).filter(isTaskOperational);
  const boardTasks = (operationalTasks as Omit<
    BoardTask,
    "tracked_seconds" | "focus_user_id"
  >[]).map((task) => ({
    ...task,
    tracked_seconds: Math.round(trackedSeconds.get(task.id) ?? 0),
    focus_user_id:
      activeFocusSessions?.find((session) => session.task_id === task.id)
        ?.user_id ?? null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Доска</h1>
        <p className="text-sm text-neutral-500">
          Перетаскивайте задачи между колонками, чтобы менять статус.
        </p>
      </div>
      <KanbanBoard
        tasks={boardTasks}
        projects={sortProjectsForDisplay(projects ?? [])
          .filter((project) => isOperationalProject(project.stage))
          .map((project) => ({
            id: project.id,
            name: project.name,
          }))}
        profiles={(profiles ?? []).map((profile) => ({
          id: profile.id,
          name: profile.full_name,
        }))}
        timeSnapshotAt={timeSnapshotAt.toISOString()}
      />
      {filters.task && (
        <TaskDrawer
          taskId={filters.task}
          closeHref={buildBoardHref(filters, { task: undefined })}
        />
      )}
    </div>
  );
}

function buildBoardHref(
  current: BoardSearchParams,
  overrides: Partial<
    Record<keyof BoardSearchParams, string | undefined>
  >,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...overrides })) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `/board${query ? `?${query}` : ""}`;
}
