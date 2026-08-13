"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clock3 } from "lucide-react";

import { updateTaskStatus } from "@/app/(dashboard)/tasks/actions";
import { Avatar } from "@/components/avatar";
import { PriorityBadge } from "@/components/badges";
import { FilterSelect } from "@/components/filter-select";
import { ProjectBadge } from "@/components/project-badge";
import { BOARD_COLUMNS, sortBoardTasks } from "@/lib/board-sort";
import { formatDate, formatTimerDuration, todayISO } from "@/lib/format";
import { PRIORITY_ACCENT, TASK_STATUS_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const COLUMN_DOT: Record<Enums<"task_status">, string> = {
  backlog: "bg-neutral-400",
  todo: "bg-blue-500",
  in_progress: "bg-amber-500",
  ai_wait: "bg-cyan-500",
  review: "bg-violet-500",
  paused: "bg-orange-500",
  done: "bg-emerald-500",
  cancelled: "bg-red-500",
};

export type BoardTask = {
  id: string;
  title: string;
  status: Enums<"task_status"> | null;
  priority: Enums<"task_priority"> | null;
  due_date: string | null;
  is_important: boolean | null;
  is_urgent: boolean | null;
  project: { id: string; name: string } | null;
  assignee: { id: string; full_name: string } | null;
  tracked_seconds: number;
  focus_user_id: string | null;
};

type FilterOption = { id: string; name: string };

export function KanbanBoard({
  tasks,
  projects,
  profiles,
  timeSnapshotAt,
}: {
  tasks: BoardTask[];
  projects: FilterOption[];
  profiles: FilterOption[];
  timeSnapshotAt: string;
}) {
  const [, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const [optimisticTasks, moveOptimistic] = useOptimistic(
    tasks,
    (state, move: { id: string; status: Enums<"task_status"> }) =>
      state.map((t) => (t.id === move.id ? { ...t, status: move.status } : t)),
  );
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [timerNow, setTimerNow] = useState(() =>
    new Date(timeSnapshotAt).getTime(),
  );
  const projectFilter = searchParams.get("project");
  const assigneeFilter = searchParams.get("assignee");
  const today = todayISO();

  useEffect(() => {
    if (!optimisticTasks.some((task) => task.status === "in_progress")) return;
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [optimisticTasks]);

  function taskHref(taskId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("task", taskId);
    return `/board?${params.toString()}`;
  }

  const filteredTasks = optimisticTasks.filter((task) => {
    if (projectFilter && task.project?.id !== projectFilter) return false;
    if (assigneeFilter && task.assignee?.id !== assigneeFilter) return false;
    return true;
  });

  function handleDrop(e: React.DragEvent, status: Enums<"task_status">) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/task-id");
    if (!id) return;
    startTransition(async () => {
      setStatusError(null);
      setStatusNotice(null);
      moveOptimistic({ id, status });
      const result = await updateTaskStatus(id, status);
      if (!result.success) setStatusError(result.error);
      else if (result.warning) setStatusNotice(result.warning);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <FilterSelect
          name="project"
          label="Проект"
          options={projects.map((project) => ({
            value: project.id,
            label: project.name,
          }))}
        />
        <FilterSelect
          name="assignee"
          label="Исполнитель"
          options={profiles.map((profile) => ({
            value: profile.id,
            label: profile.name,
          }))}
        />
      </div>
      {statusError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          Не удалось переместить задачу: {statusError}
        </p>
      )}
      {statusNotice && (
        <p
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          {statusNotice}
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {BOARD_COLUMNS.map((status) => {
          const columnTasks = sortBoardTasks(
            filteredTasks.filter(
              (task) => (task.status ?? "todo") === status,
            ),
            today,
          );
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(status);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, status)}
              className={cn(
                "flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2 transition-colors",
                dragOver === status && "border-neutral-400 bg-neutral-100",
              )}
            >
              <div className="flex items-center justify-between px-1 pt-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      COLUMN_DOT[status],
                    )}
                  />
                  {TASK_STATUS_LABEL[status]}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-neutral-500 shadow-sm ring-1 ring-neutral-200">
                  {columnTasks.length}
                </span>
              </div>
              {columnTasks.map((task) => {
                const priority = task.priority ?? "medium";
                const overdue = !!task.due_date && task.due_date < today;
                const running = task.status === "in_progress";
                const focused = Boolean(task.focus_user_id);
                const elapsedSinceSnapshot = running
                  ? Math.max(
                      0,
                      Math.floor(
                        (timerNow - new Date(timeSnapshotAt).getTime()) / 1_000,
                      ),
                    )
                  : 0;
                const trackedSeconds =
                  task.tracked_seconds + elapsedSinceSnapshot;

                return (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/task-id", task.id);
                    }}
                    className={cn(
                      "group relative cursor-grab rounded-md border border-l-4 border-neutral-200 bg-white p-2.5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing",
                      PRIORITY_ACCENT[priority],
                    )}
                  >
                    <Link
                      href={taskHref(task.id)}
                      draggable={false}
                      aria-label={`Открыть задачу «${task.title}»`}
                      className="absolute inset-0 z-10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
                    >
                      <span className="sr-only">Открыть редактор задачи</span>
                    </Link>
                    <p className="text-sm font-medium text-neutral-900 group-hover:underline">
                      {task.title}
                    </p>
                    {focused && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                        В фокусе
                      </span>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                      <PriorityBadge priority={priority} />
                      {task.due_date && (
                        <span
                          className={cn(
                            "rounded-full bg-neutral-100 px-2 py-0.5",
                            overdue && "bg-red-50 text-red-600",
                          )}
                        >
                          {formatDate(task.due_date)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <ProjectBadge
                        projectId={task.project?.id}
                        name={task.project?.name}
                        className="max-w-44"
                      />
                      <Avatar name={task.assignee?.full_name} />
                    </div>
                    {(trackedSeconds > 0 || running) && (
                      <div
                        className={cn(
                          "mt-2 flex items-center gap-1 border-t border-neutral-100 pt-2 text-xs font-medium",
                          running ? "text-amber-700" : "text-neutral-500",
                        )}
                      >
                        <Clock3
                          className={cn("size-3.5", running && "animate-pulse")}
                          aria-hidden
                        />
                        {running ? "В работе: " : "Затрачено: "}
                        <span className="font-mono tabular-nums">
                          {formatTimerDuration(trackedSeconds)}
                        </span>
                      </div>
                    )}
                  </article>
                );
              })}
              {columnTasks.length === 0 && (
                <p className="px-1 pb-2 text-xs text-neutral-400">Пусто</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
