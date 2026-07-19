"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";

import { updateTaskStatus } from "@/app/(dashboard)/tasks/actions";
import { PriorityBadge } from "@/components/badges";
import { formatDate } from "@/lib/format";
import { TASK_STATUS_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const COLUMNS: Enums<"task_status">[] = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
];

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

export function KanbanBoard({ tasks }: { tasks: BoardTask[] }) {
  const [, startTransition] = useTransition();
  const [optimisticTasks, moveOptimistic] = useOptimistic(
    tasks,
    (state, move: { id: string; status: Enums<"task_status"> }) =>
      state.map((t) => (t.id === move.id ? { ...t, status: move.status } : t)),
  );
  const [dragOver, setDragOver] = useState<string | null>(null);

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
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUMNS.map((status) => {
        const columnTasks = optimisticTasks.filter(
          (t) => (t.status ?? "todo") === status,
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
              <span className="text-sm font-semibold text-neutral-700">
                {TASK_STATUS_LABEL[status]}
              </span>
              <span className="text-xs text-neutral-400">
                {columnTasks.length}
              </span>
            </div>
            {columnTasks.map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("text/task-id", task.id)
                }
                className="cursor-grab rounded-md border border-neutral-200 bg-white p-2.5 shadow-sm active:cursor-grabbing"
              >
                <Link
                  href={`/tasks?task=${task.id}`}
                  className="text-sm font-medium text-neutral-900 hover:underline"
                >
                  {task.title}
                </Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                  <PriorityBadge priority={task.priority ?? "medium"} />
                  {task.due_date && <span>{formatDate(task.due_date)}</span>}
                </div>
                <div className="mt-1 flex justify-between text-xs text-neutral-400">
                  <span className="truncate">
                    {task.project?.name ?? "Личное"}
                  </span>
                  <span className="shrink-0">
                    {task.assignee?.full_name?.split(" ")[0] ?? ""}
                  </span>
                </div>
              </div>
            ))}
            {columnTasks.length === 0 && (
              <p className="px-1 pb-2 text-xs text-neutral-400">Пусто</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
