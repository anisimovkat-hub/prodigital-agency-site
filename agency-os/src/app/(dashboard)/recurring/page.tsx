import { PriorityBadge, TaskTypeBadge } from "@/components/badges";
import { ProjectBadge } from "@/components/project-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { sortProjectsForDisplay } from "@/lib/project-order";
import type { Enums } from "@/lib/supabase/types";
import type { RecurringFrequency } from "@/lib/validation";

import { RecurringForm } from "./recurring-form";
import { RecurringItem } from "./recurring-item";

type RecurringTaskView = {
  id: string;
  title: string;
  workstream: string | null;
  task_type: Enums<"task_type">;
  priority: Enums<"task_priority">;
  frequency: RecurringFrequency;
  weekdays: number[] | null;
  anchor_date: string;
  is_active: boolean;
  project: { id: string; name: string } | null;
  assignee: { id: string; full_name: string } | null;
};

export default async function RecurringPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data }, { data: projects }, { data: profiles }] =
    await Promise.all([
      user
        ? supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("recurring_tasks")
        .select(
          "*, project:projects(id,name), assignee:profiles!recurring_tasks_assignee_id_fkey(id,full_name)",
        )
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name,stage"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
    ]);

  const canManage = profile?.role === "owner";
  const recurringTasks = (data ?? []) as RecurringTaskView[];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Повторы</h1>
        <p className="text-sm text-neutral-500">
          Шаблоны автоматически создают обычные задачи в нужные дни.
        </p>
      </div>

      {canManage && (
        <details className="group rounded-lg border border-neutral-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
            + Новый повтор
          </summary>
          <div className="mt-4">
            <RecurringForm
              projects={sortProjectsForDisplay(projects ?? []).map((project) => ({
                id: project.id,
                name: project.name,
              }))}
              profiles={(profiles ?? []).map((employee) => ({
                id: employee.id,
                full_name: employee.full_name,
              }))}
              anchorDate={todayISO()}
            />
          </div>
        </details>
      )}

      {!canManage && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Здесь показаны ваши шаблоны. Создавать и менять повторы может владелец.
        </p>
      )}

      {recurringTasks.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white py-14 text-center">
          <p className="font-medium text-neutral-900">Шаблонов пока нет</p>
          <p className="mt-1 text-sm text-neutral-500">
            Создайте первый повтор для регулярной задачи.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {recurringTasks.map((task) => (
            <Card
              key={task.id}
              className={task.is_active ? "" : "bg-neutral-50 opacity-75"}
            >
              <CardHeader className="gap-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{task.title}</CardTitle>
                  <span
                    className={
                      task.is_active
                        ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                        : "rounded-full bg-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600"
                    }
                  >
                    {task.is_active ? "Активен" : "На паузе"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ProjectBadge
                    projectId={task.project?.id}
                    name={task.project?.name}
                  />
                  <PriorityBadge priority={task.priority} />
                  <TaskTypeBadge type={task.task_type} />
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <dl className="grid gap-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-neutral-500">Исполнитель</dt>
                    <dd className="text-right text-neutral-800">
                      {task.assignee?.full_name ?? "Не назначен"}
                    </dd>
                  </div>
                  {task.workstream && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">Направление</dt>
                      <dd className="text-right text-neutral-800">
                        {task.workstream}
                      </dd>
                    </div>
                  )}
                </dl>
                <RecurringItem
                  recurringTask={{
                    id: task.id,
                    frequency: task.frequency,
                    weekdays: task.weekdays,
                    anchor_date: task.anchor_date,
                    is_active: task.is_active,
                  }}
                  canManage={canManage}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
