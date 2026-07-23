"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { updateTaskStatus } from "@/app/(dashboard)/tasks/actions";
import { Avatar } from "@/components/avatar";
import { PriorityBadge } from "@/components/badges";
import { FilterSelect } from "@/components/filter-select";
import { formatDate, todayISO } from "@/lib/format";
import { PRIORITY_ACCENT, TASK_STATUS_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const COLUMNS: Enums<"task_status">[] = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "paused",
  "done",
];

const COLUMN_DOT: Record<Enums<"task_status">, string> = {
  backlog: "bg-neutral-400",
  todo: "bg-blue-500",
  in_progress: "bg-amber-500",
  review: "bg-violet-500",
  paused: "bg-orange-500",
  done: "bg-emerald-500",
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
};

type FilterOption = { id: string; name: string };

export function KanbanBoard({
  tasks,
  projects,
  profiles,
}: {
  tasks: BoardTask[];
  projects: FilterOption[];
  profiles: FilterOption[];
}) {
  const [, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const [optimisticTasks, moveOptimistic] = useOptimistic(
    tasks,
    (state, move: { id: string; status: Enums<"task_status"> }) =>
      state.map((t) => (t.id === move.id ? { ...t, status: move.status } : t)),
  );
  const [dragOver, setDragOver] = useState<string | null>(null);
  const projectFilter = searchParams.get("project");
  const assigneeFilter = searchParams.get("assignee");
  const today = todayISO();

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
      moveOptimistic({ id, status });
      await updateTaskStatus(id, status);
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

      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((status) => {
          const columnTasks = filteredTasks.filter(
            (task) => (task.status ?? "todo") === status,
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

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/task-id", task.id)
                    }
                    className={cn(
                      "cursor-grab rounded-md border border-l-4 border-neutral-200 bg-white p-2.5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing",
                      PRIORITY_ACCENT[priority],
                    )}
                  >
                    <Link
                      href={`/tasks?task=${task.id}`}
                      className="text-sm font-medium text-neutral-900 hover:underline"
                    >
                      {task.title}
                    </Link>
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
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-neutral-400">
                      <span className="truncate">
                        {task.project?.name ?? "Личное"}
                      </span>
                      <Avatar name={task.assignee?.full_name} />
                    </div>
                  </div>
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
