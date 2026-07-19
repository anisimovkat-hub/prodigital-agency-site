import { KanbanBoard, type BoardTask } from "@/app/(dashboard)/board/kanban-board";
import { createClient } from "@/lib/supabase/server";

export default async function BoardPage() {
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "id,title,status,priority,due_date,is_important,is_urgent,project:projects(id,name), assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Доска</h1>
        <p className="text-sm text-neutral-500">
          Перетаскивайте задачи между колонками, чтобы менять статус.
        </p>
      </div>
      <KanbanBoard tasks={(tasks ?? []) as BoardTask[]} />
    </div>
  );
}
