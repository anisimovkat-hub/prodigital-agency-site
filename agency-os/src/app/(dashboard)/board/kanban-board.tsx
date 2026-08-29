"use client";

import {
  useEffect,
  useOptimistic,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clock3, GripVertical, Sparkles } from "lucide-react";

import {
  reorderTasksOnBoard,
  updateTaskStatus,
} from "@/app/(dashboard)/tasks/actions";
import { TaskQuickSelect } from "@/app/(dashboard)/tasks/task-quick-select";
import { FilterSelect } from "@/components/filter-select";
import { ProjectBadge } from "@/components/project-badge";
import {
  BOARD_COLUMNS,
  buildManualBoardOrder,
  sortBoardTasks,
  sortBoardTasksManually,
} from "@/lib/board-sort";
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

const BOARD_SORT_MODE_KEY = "agency-os:board-sort-mode";
const BOARD_SORT_MODE_EVENT = "agency-os:board-sort-mode-change";
type BoardSortMode = "smart" | "manual";

export type BoardTask = {
  id: string;
  title: string;
  status: Enums<"task_status"> | null;
  priority: Enums<"task_priority"> | null;
  due_date: string | null;
  completed_at: string | null;
  board_position: number | null;
  is_important: boolean | null;
  is_urgent: boolean | null;
  project: { id: string; name: string } | null;
  assignee: { id: string; full_name: string } | null;
  tracked_seconds: number;
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
    (
      state,
      move: {
        id: string;
        status: Enums<"task_status">;
        orderedIds?: string[];
      },
    ) => {
      const positions = new Map(
        (move.orderedIds ?? []).map((id, index) => [id, (index + 1) * 1000]),
      );
      return state.map((task) => {
        if (task.id === move.id) {
          return {
            ...task,
            status: move.status,
            board_position:
              positions.get(task.id) ?? task.board_position,
          };
        }
        const position = positions.get(task.id);
        return position == null
          ? task
          : { ...task, board_position: position };
      });
    },
  );
  const sortMode = useSyncExternalStore(
    subscribeBoardSortMode,
    readBoardSortMode,
    () => "smart" as BoardSortMode,
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

  function handleDrop(
    e: React.DragEvent,
    status: Enums<"task_status">,
    beforeTaskId?: string,
  ) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/task-id");
    if (!id) return;
    const draggedTask = optimisticTasks.find((task) => task.id === id);
    if (!draggedTask || beforeTaskId === id) return;

    if (sortMode === "smart" && (draggedTask.status ?? "todo") === status) {
      setStatusNotice(
        "В автоматическом режиме порядок задают дедлайн и приоритет. Для свободной перестановки включите «Мой порядок».",
      );
      return;
    }

    const targetOrder =
      sortMode === "manual"
        ? buildManualBoardOrder(
            optimisticTasks,
            id,
            status,
            beforeTaskId,
            today,
          )
        : undefined;

    startTransition(async () => {
      setStatusError(null);
      setStatusNotice(null);
      moveOptimistic({ id, status, orderedIds: targetOrder });
      const result = targetOrder
        ? await reorderTasksOnBoard(targetOrder, status, id)
        : await updateTaskStatus(id, status);
      if (!result.success) setStatusError(result.error);
      else if (result.warning) setStatusNotice(result.warning);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
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
        <div className="ml-auto">
          <p className="mb-1 text-xs text-neutral-500">Порядок карточек</p>
          <div
            className="inline-flex rounded-lg bg-neutral-100 p-1"
            role="group"
            aria-label="Порядок карточек"
          >
            <button
              type="button"
              onClick={() => saveBoardSortMode("smart")}
              aria-pressed={sortMode === "smart"}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition",
                sortMode === "smart"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-900",
              )}
            >
              <Sparkles className="size-4" aria-hidden />
              По важности
            </button>
            <button
              type="button"
              onClick={() => saveBoardSortMode("manual")}
              aria-pressed={sortMode === "manual"}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition",
                sortMode === "manual"
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-900",
              )}
            >
              <GripVertical className="size-4" aria-hidden />
              Мой порядок
            </button>
          </div>
        </div>
      </div>
      <p className="-mt-2 text-xs text-neutral-500">
        {sortMode === "smart"
          ? "Сначала задачи с дедлайном и приоритетом, затем остальные по срочности."
          : "Перетаскивайте карточки вверх, вниз и между колонками — порядок сохранится."}
      </p>
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
          const tasksInColumn = filteredTasks.filter(
            (task) => (task.status ?? "todo") === status,
          );
          const columnTasks =
            sortMode === "manual"
              ? sortBoardTasksManually(tasksInColumn, today)
              : sortBoardTasks(tasksInColumn, today);
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(`column:${status}`);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, status)}
              className={cn(
                "flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2 transition-colors",
                dragOver === `column:${status}` &&
                  "border-neutral-400 bg-neutral-100",
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
                    onDragOver={(event) => {
                      if (sortMode !== "manual") return;
                      event.preventDefault();
                      event.stopPropagation();
                      setDragOver(`task:${task.id}`);
                    }}
                    onDrop={(event) => {
                      if (sortMode !== "manual") return;
                      event.stopPropagation();
                      handleDrop(event, status, task.id);
                    }}
                    onDragEnd={() => setDragOver(null)}
                    className={cn(
                      "group relative cursor-grab rounded-md border border-l-4 border-neutral-200 bg-white p-2.5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing",
                      PRIORITY_ACCENT[priority],
                      dragOver === `task:${task.id}` &&
                        "translate-y-1 ring-2 ring-blue-300",
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
                    <div className="flex items-start gap-1">
                      <p className="min-w-0 flex-1 text-sm font-medium text-neutral-900 group-hover:underline">
                        {task.title}
                      </p>
                      <GripVertical
                        className="mt-0.5 size-4 shrink-0 text-neutral-300"
                        aria-hidden
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                      <TaskQuickSelect
                        taskId={task.id}
                        taskTitle={task.title}
                        field="priority"
                        value={task.priority}
                        compact
                      />
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
                      <TaskQuickSelect
                        taskId={task.id}
                        taskTitle={task.title}
                        field="assignee_id"
                        value={task.assignee?.id ?? null}
                        options={profiles}
                        compact
                        className="max-w-32"
                      />
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

function subscribeBoardSortMode(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(BOARD_SORT_MODE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(BOARD_SORT_MODE_EVENT, callback);
  };
}

function readBoardSortMode(): BoardSortMode {
  return window.localStorage.getItem(BOARD_SORT_MODE_KEY) === "manual"
    ? "manual"
    : "smart";
}

function saveBoardSortMode(mode: BoardSortMode) {
  window.localStorage.setItem(BOARD_SORT_MODE_KEY, mode);
  window.dispatchEvent(new Event(BOARD_SORT_MODE_EVENT));
}
