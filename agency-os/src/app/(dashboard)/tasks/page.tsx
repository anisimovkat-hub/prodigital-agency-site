import Link from "next/link";

import { TaskDrawer } from "@/app/(dashboard)/tasks/task-drawer";
import { TaskDueDateCell } from "@/app/(dashboard)/tasks/task-due-date-cell";
import { TaskForm } from "@/app/(dashboard)/tasks/task-form";
import { TaskQuickSelect } from "@/app/(dashboard)/tasks/task-quick-select";
import { TaskStatusBadge } from "@/components/badges";
import { FilterCheckbox } from "@/components/filter-checkbox";
import { FilterSelect } from "@/components/filter-select";
import { ProjectBadge } from "@/components/project-badge";
import { TaskDoneCheckbox } from "@/components/task-done-checkbox";
import { TaskViewSwitcher } from "@/components/task-view-switcher";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_TYPE_LABEL,
} from "@/lib/labels";
import { formatDuration } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { isCompletedTaskVisible } from "@/lib/task-retention";
import { sortProjectsForDisplay } from "@/lib/project-order";
import {
  isOperationalProject,
  isTaskOperational,
} from "@/lib/project-lifecycle";
import {
  filterProfilesByTaskAccess,
  filterTasksByAudience,
} from "@/lib/task-audience-filter";
import { sumRawTaskTime } from "@/lib/time-analytics";
import { cn } from "@/lib/utils";

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
  who?: string;
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? "";
  const isCompletedView = filters.view === "completed";
  const timeSnapshotAt = new Date();

  let tasksQuery = supabase
    .from("tasks")
    .select(
      "*, project:projects(id,name,stage), assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
    )
    .order(isCompletedView ? "completed_at" : "created_at", {
      ascending: false,
      nullsFirst: false,
    });

  tasksQuery = isCompletedView
    ? tasksQuery.eq("status", "done")
    : tasksQuery.neq("status", "done").neq("status", "cancelled");

  const [
    { data: tasks },
    { data: projects },
    { data: profiles },
    { data: timeEntries },
  ] =
    await Promise.all([
      tasksQuery,
      supabase.from("projects").select("id,name,stage"),
      supabase
        .from("profiles")
        .select("id,full_name,role,is_active")
        .order("full_name"),
      supabase
        .from("task_time_entries")
        .select("task_id,started_at,ended_at"),
    ]);
  const trackedSeconds = sumRawTaskTime(
    timeEntries ?? [],
    timeSnapshotAt,
  );

  const visibleTasks = isCompletedView
    ? (tasks ?? []).filter((task) =>
        isCompletedTaskVisible(task.completed_at, timeSnapshotAt),
      )
    : (tasks ?? []).filter(isTaskOperational);
  const audienceTasks = filterTasksByAudience(visibleTasks, {
    userId: uid,
    who: filters.who,
    assigneeId: filters.assignee,
  });
  const filtered = audienceTasks.filter((task) => {
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
  const currentProfile = (profiles ?? []).find((profile) => profile.id === uid);
  const canViewAll = currentProfile?.role === "owner";
  const audienceProfiles = filterProfilesByTaskAccess(
    (profiles ?? []).filter((profile) => profile.is_active),
    visibleTasks,
    { userId: uid, canViewAll },
  );
  const activeAudience = filters.assignee ? "assignee" : filters.who ?? "all";

  const closeHref = buildHref(filters, { task: undefined });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {isCompletedView ? "Выполненные задачи" : "Задачи"}
          </h1>
          <p className="text-sm text-neutral-500">
            {isCompletedView
              ? "Задачи хранятся здесь 3 дня после завершения, затем удаляются."
              : "Список: все активные задачи агентства с фильтрами."}
          </p>
        </div>
        <TaskViewSwitcher />
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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-1 border-b border-neutral-200">
          {[
            { key: "all", label: "Все", who: undefined },
            { key: "mine", label: "Мои", who: "mine" },
            { key: "personal", label: "Личные", who: "personal" },
            { key: "team", label: "Команда", who: "team" },
          ].map((tab) => (
            <Link
              key={tab.key}
              href={buildHref(filters, {
                who: tab.who,
                assignee: undefined,
                task: undefined,
              })}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                activeAudience === tab.key
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-800",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <FilterSelect
          name="assignee"
          label="Сотрудник"
          options={audienceProfiles.map((profile) => ({
            value: profile.id,
            label: profile.full_name,
          }))}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterSelect
          name="project"
          label="Проект"
          options={sortProjectsForDisplay(projects ?? [])
            .filter(
              (project) =>
                isCompletedView || isOperationalProject(project.stage),
            )
            .map((p) => ({ value: p.id, label: p.name }))}
        />
        {!isCompletedView && (
          <FilterSelect
            name="status"
            label="Статус"
            options={enumOptions(TASK_STATUS_LABEL).filter(
              ({ value }) => value !== "done" && value !== "cancelled",
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
        <details className="group rounded-lg border border-neutral-200 bg-white p-3">
          <summary className="inline-flex cursor-pointer list-none items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 [&::-webkit-details-marker]:hidden">
            + Новая задача
          </summary>
          <div className="mt-4">
            <TaskForm
              projects={sortProjectsForDisplay(projects ?? [])
                .filter((project) => isOperationalProject(project.stage))
                .map((p) => ({
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
            <TableHead>Затрачено</TableHead>
            <TableHead>Важно</TableHead>
            <TableHead>Срочно</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableEmpty colSpan={11}>
              {isCompletedView
                ? "Выполненных задач за последние 3 дня нет."
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
              <TableCell>
                <TaskQuickSelect
                  taskId={task.id}
                  taskTitle={task.title}
                  field="assignee_id"
                  value={task.assignee_id}
                  options={audienceProfiles.map((profile) => ({
                    id: profile.id,
                    name: profile.full_name,
                  }))}
                />
              </TableCell>
              <TableCell>
                <TaskStatusBadge status={task.status ?? "todo"} />
              </TableCell>
              <TableCell>
                <TaskQuickSelect
                  taskId={task.id}
                  taskTitle={task.title}
                  field="priority"
                  value={task.priority}
                />
              </TableCell>
              <TableCell>
                {TASK_TYPE_LABEL[task.task_type ?? "other"]}
              </TableCell>
              <TableCell className="p-1">
                <TaskDueDateCell
                  taskId={task.id}
                  taskTitle={task.title}
                  dueDate={task.due_date}
                  status={task.status}
                />
              </TableCell>
              <TableCell className="whitespace-nowrap text-neutral-600">
                {trackedSeconds.has(task.id)
                  ? formatDuration(
                      Math.round((trackedSeconds.get(task.id) ?? 0) / 60),
                    )
                  : "—"}
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
