import Link from "next/link";

import { TaskDrawer } from "@/app/(dashboard)/tasks/task-drawer";
import { TaskForm } from "@/app/(dashboard)/tasks/task-form";
import { PriorityBadge, TaskStatusBadge } from "@/components/badges";
import { FilterCheckbox } from "@/components/filter-checkbox";
import { FilterSelect } from "@/components/filter-select";
import { ProjectBadge } from "@/components/project-badge";
import { TaskDoneCheckbox } from "@/components/task-done-checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, isOverdue } from "@/lib/format";
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_TYPE_LABEL,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { completedTasksVisibleSince } from "@/lib/task-retention";

type SearchParams = {
  project?: string;
  assignee?: string;
  status?: string;
  priority?: string;
  type?: string;
  important?: string;
  urgent?: string;
  task?: string;
  view?: string;
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = await searchParams;
  const supabase = await createClient();
  const isCompletedView = filters.view === "completed";

  let tasksQuery = supabase
    .from("tasks")
    .select(
      "*, project:projects(id,name), assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
    )
    .order(isCompletedView ? "completed_at" : "created_at", {
      ascending: false,
      nullsFirst: false,
    });

  tasksQuery = isCompletedView
    ? tasksQuery
        .eq("status", "done")
        .or(
          `completed_at.gte.${completedTasksVisibleSince().toISOString()},completed_at.is.null`,
        )
    : tasksQuery.neq("status", "done");

  const [{ data: tasks }, { data: projects }, { data: profiles }] =
    await Promise.all([
      tasksQuery,
      supabase.from("projects").select("id,name").order("name"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
    ]);

  const filtered = (tasks ?? []).filter((task) => {
    if (filters.project && task.project_id !== filters.project) return false;
    if (filters.assignee && task.assignee_id !== filters.assignee)
      return false;
    if (!isCompletedView && filters.status && task.status !== filters.status)
      return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.type && task.task_type !== filters.type) return false;
    if (filters.important === "1" && !task.is_important) return false;
    if (filters.urgent === "1" && !task.is_urgent) return false;
    return true;
  });

  const closeHref = buildHref(filters, { task: undefined });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          {isCompletedView ? "Выполненные задачи" : "Задачи"}
        </h1>
        <p className="text-sm text-neutral-500">
          {isCompletedView
            ? "Задачи хранятся здесь 1 месяц, затем уходят в архив."
            : "Активные задачи агентства с фильтрами."}
        </p>
      </div>

      <div className="flex w-fit rounded-lg border border-neutral-200 bg-neutral-50 p-1">
        <Link
          href={buildHref(filters, {
            view: undefined,
            status: filters.status === "done" ? undefined : filters.status,
            task: undefined,
          })}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            !isCompletedView
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-500 hover:text-neutral-900"
          }`}
        >
          Активные задачи
        </Link>
        <Link
          href={buildHref(filters, {
            view: "completed",
            status: undefined,
            task: undefined,
          })}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isCompletedView
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-500 hover:text-neutral-900"
          }`}
        >
          Выполненные задачи
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterSelect
          name="project"
          label="Проект"
          options={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
        />
        <FilterSelect
          name="assignee"
          label="Исполнитель"
          options={(profiles ?? []).map((p) => ({
            value: p.id,
            label: p.full_name,
          }))}
        />
        {!isCompletedView && (
          <FilterSelect
            name="status"
            label="Статус"
            options={enumOptions(TASK_STATUS_LABEL).filter(
              ({ value }) => value !== "done",
            )}
          />
        )}
        <FilterSelect
          name="priority"
          label="Приоритет"
          options={enumOptions(TASK_PRIORITY_LABEL)}
        />
        <FilterSelect
          name="type"
          label="Тип"
          options={enumOptions(TASK_TYPE_LABEL)}
        />
        <FilterCheckbox name="important" label="Важно" />
        <FilterCheckbox name="urgent" label="Срочно" />
      </div>

      {!isCompletedView && (
        <details className="group rounded-lg border border-neutral-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
            + Новая задача
          </summary>
          <div className="mt-4">
            <TaskForm
              projects={(projects ?? []).map((p) => ({
                id: p.id,
                name: p.name,
              }))}
              profiles={(profiles ?? []).map((p) => ({
                id: p.id,
                full_name: p.full_name,
              }))}
            />
          </div>
        </details>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-center">Готово</TableHead>
            <TableHead>Задача</TableHead>
            <TableHead>Проект</TableHead>
            <TableHead>Исполнитель</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Приоритет</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Дедлайн</TableHead>
            <TableHead>Важно</TableHead>
            <TableHead>Срочно</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableEmpty colSpan={10}>
              {isCompletedView
                ? "Выполненных задач за последний месяц нет."
                : "Активных задач пока нет."}
            </TableEmpty>
          )}
          {filtered.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="text-center">
                <TaskDoneCheckbox
                  taskId={task.id}
                  done={task.status === "done"}
                  label={
                    task.status === "done"
                      ? `Вернуть задачу «${task.title}» в активные`
                      : `Отметить задачу «${task.title}» выполненной`
                  }
                />
              </TableCell>
              <TableCell className="font-medium text-neutral-900">
                <Link
                  href={buildHref(filters, { task: task.id })}
                  className="hover:underline"
                >
                  {task.title}
                </Link>
              </TableCell>
              <TableCell>
                {task.project ? (
                  <Link href={`/projects/${task.project.id}`}>
                    <ProjectBadge
                      projectId={task.project.id}
                      name={task.project.name}
                      className="max-w-52"
                    />
                  </Link>
                ) : (
                  <ProjectBadge projectId={null} name={null} />
                )}
              </TableCell>
              <TableCell>{task.assignee?.full_name ?? "—"}</TableCell>
              <TableCell>
                <TaskStatusBadge status={task.status ?? "todo"} />
              </TableCell>
              <TableCell>
                <PriorityBadge priority={task.priority ?? "medium"} />
              </TableCell>
              <TableCell>
                {TASK_TYPE_LABEL[task.task_type ?? "other"]}
              </TableCell>
              <TableCell>
                <span
                  className={
                    isOverdue(task.due_date, task.status)
                      ? "text-red-600"
                      : ""
                  }
                >
                  {formatDate(task.due_date)}
                </span>
              </TableCell>
              <TableCell>{task.is_important ? "Да" : "—"}</TableCell>
              <TableCell>{task.is_urgent ? "Да" : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {filters.task && <TaskDrawer taskId={filters.task} closeHref={closeHref} />}
    </div>
  );
}

function enumOptions<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }));
}

function buildHref(
  current: SearchParams,
  overrides: Partial<Record<keyof SearchParams, string | undefined>>,
) {
  const merged: SearchParams = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `/tasks${query ? `?${query}` : ""}`;
}
