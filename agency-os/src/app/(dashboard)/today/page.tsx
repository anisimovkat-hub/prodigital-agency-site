import { TodayTable } from "@/app/(dashboard)/today/today-table";
import { sortTodayTasks } from "@/lib/today-sort";
import { createClient } from "@/lib/supabase/server";

export default async function TodayPage() {
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "*, project:projects(id,name), assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
    )
    .neq("status", "done");

  const sorted = sortTodayTasks(tasks ?? []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Сегодня</h1>
        <p className="text-sm text-neutral-500">
          Просроченные, срочные и сегодняшние задачи по всем проектам.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white py-16 text-center">
          <p className="text-base font-medium text-neutral-900">
            Сегодня задач нет 🎉
          </p>
          <p className="text-sm text-neutral-500">
            Просроченных и срочных задач тоже нет. Можно выдохнуть.
          </p>
        </div>
      ) : (
        <TodayTable tasks={sorted} />
      )}
    </div>
  );
}
