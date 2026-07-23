import { KanbanBoard, type BoardTask } from "@/app/(dashboard)/board/kanban-board";
import { TaskDrawer } from "@/app/(dashboard)/tasks/task-drawer";
import { createClient } from "@/lib/supabase/server";

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

  const [{ data: tasks }, { data: projects }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "id,title,status,priority,due_date,is_important,is_urgent,project:projects(id,name), assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
        )
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name").order("name"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Доска</h1>
        <p className="text-sm text-neutral-500">
          Перетаскивайте задачи между колонками, чтобы менять статус.
        </p>
      </div>
      <KanbanBoard
        tasks={(tasks ?? []) as BoardTask[]}
        projects={(projects ?? []).map((project) => ({
          id: project.id,
          name: project.name,
        }))}
        profiles={(profiles ?? []).map((profile) => ({
          id: profile.id,
          name: profile.full_name,
        }))}
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
