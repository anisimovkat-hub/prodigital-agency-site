"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  GripVertical,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  type DragEvent,
  type KeyboardEvent,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { TaskQuickSelect } from "@/app/(dashboard)/tasks/task-quick-select";
import { TaskDueDateCell } from "@/app/(dashboard)/tasks/task-due-date-cell";
import { TaskStatusBadge } from "@/components/badges";
import { ProjectBadge } from "@/components/project-badge";
import { TaskDoneCheckbox } from "@/components/task-done-checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Tables } from "@/lib/supabase/types";
import {
  DEFAULT_TODAY_COLUMN_ORDER,
  moveTodayColumn,
  normalizeTodayColumnOrder,
  sortTodayTableRows,
  type SortDirection,
  type TodayColumnId,
  type TodayTableSort,
} from "@/lib/today-table";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "agency-os:today-column-order";
const STORAGE_EVENT = "agency-os:today-column-order-changed";
const DEFAULT_COLUMN_ORDER_SNAPSHOT = JSON.stringify(
  DEFAULT_TODAY_COLUMN_ORDER,
);

const COLUMN_LABELS: Record<TodayColumnId, string> = {
  project: "Проект",
  title: "Задача",
  assignee: "Исполнитель",
  priority: "Приоритет",
  due_date: "Дедлайн",
  status: "Статус",
  done: "Сделано",
};

const INITIAL_SORT_DIRECTION: Record<TodayColumnId, SortDirection> = {
  project: "asc",
  title: "asc",
  assignee: "asc",
  priority: "desc",
  due_date: "asc",
  status: "asc",
  done: "asc",
};

export type TodayTask = Tables<"tasks"> & {
  project: { id: string; name: string } | null;
  assignee: { id: string; full_name: string } | null;
};

type TodayRow = {
  task: TodayTask;
  title: string;
  projectName: string | null;
  assigneeName: string | null;
  priority: TodayTask["priority"];
  dueDate: string | null;
  status: TodayTask["status"];
  done: boolean;
};

type TodayProfileOption = { id: string; name: string };

export function TodayTable({
  tasks,
  profiles,
}: {
  tasks: TodayTask[];
  profiles: TodayProfileOption[];
}) {
  const searchParams = useSearchParams();
  const [sort, setSort] = useState<TodayTableSort | null>(null);
  const [volatileColumnOrder, setVolatileColumnOrder] = useState<
    TodayColumnId[] | null
  >(null);
  const [draggedColumn, setDraggedColumn] = useState<TodayColumnId | null>(null);
  const [dragOverColumn, setDragOverColumn] =
    useState<TodayColumnId | null>(null);
  const columnOrderSnapshot = useSyncExternalStore(
    subscribeToColumnOrder,
    getColumnOrderSnapshot,
    getDefaultColumnOrderSnapshot,
  );
  const savedColumnOrder = useMemo(
    () => parseColumnOrderSnapshot(columnOrderSnapshot),
    [columnOrderSnapshot],
  );
  const columnOrder = volatileColumnOrder ?? savedColumnOrder;

  const rows = useMemo<TodayRow[]>(
    () =>
      tasks.map((task) => ({
        task,
        title: task.title,
        projectName: task.project?.name ?? null,
        assigneeName: task.assignee?.full_name ?? null,
        priority: task.priority,
        dueDate: task.due_date,
        status: task.status,
        done: task.status === "done",
      })),
    [tasks],
  );

  const sortedRows = useMemo(
    () => sortTodayTableRows(rows, sort),
    [rows, sort],
  );

  function toggleSort(column: TodayColumnId) {
    setSort((current) => {
      if (current?.column !== column) {
        return { column, direction: INITIAL_SORT_DIRECTION[column] };
      }

      return {
        column,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
  }

  function persistColumnOrder(next: TodayColumnId[]) {
    setVolatileColumnOrder(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setVolatileColumnOrder(null);
    } catch {
      // Порядок всё равно меняется в текущей вкладке, даже если storage недоступен.
    }
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }

  function moveColumn(source: TodayColumnId, target: TodayColumnId) {
    persistColumnOrder(moveTodayColumn(columnOrder, source, target));
  }

  function handleDragStart(
    event: DragEvent<HTMLSpanElement>,
    column: TodayColumnId,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", column);
    setDraggedColumn(column);
  }

  function handleDrop(
    event: DragEvent<HTMLTableCellElement>,
    target: TodayColumnId,
  ) {
    event.preventDefault();
    const source = normalizeDraggedColumn(
      draggedColumn ?? event.dataTransfer.getData("text/plain"),
    );

    if (source) moveColumn(source, target);
    setDraggedColumn(null);
    setDragOverColumn(null);
  }

  function handleMoveKeyDown(
    event: KeyboardEvent<HTMLSpanElement>,
    column: TodayColumnId,
  ) {
    if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const currentIndex = columnOrder.indexOf(column);
    const targetIndex =
      event.key === "ArrowLeft" ? currentIndex - 1 : currentIndex + 1;
    const target = columnOrder[targetIndex];
    if (target) moveColumn(column, target);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-neutral-500">
        Нажмите на название столбца для сортировки. Потяните за{" "}
        <GripVertical className="inline size-3.5 align-[-3px]" aria-hidden />
        , чтобы изменить порядок.
      </p>

      <Table className="min-w-[880px]">
        <TableHeader>
          <TableRow>
            {columnOrder.map((column) => (
              <TableHead
                key={column}
                aria-sort={getAriaSort(sort, column)}
                className={cn(
                  "transition-colors",
                  dragOverColumn === column && "bg-blue-50",
                )}
                onDragEnter={() => setDragOverColumn(column)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => handleDrop(event, column)}
              >
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-1 rounded px-0.5 py-1 text-left hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                    onClick={() => toggleSort(column)}
                  >
                    <span>{COLUMN_LABELS[column]}</span>
                    <SortIcon sort={sort} column={column} />
                  </button>
                  <span
                    draggable
                    role="button"
                    tabIndex={0}
                    aria-label={`Переместить столбец «${COLUMN_LABELS[column]}». Alt + стрелка влево или вправо`}
                    title="Перетащить столбец"
                    className="cursor-grab rounded p-0.5 text-neutral-300 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 active:cursor-grabbing"
                    onDragStart={(event) => handleDragStart(event, column)}
                    onDragEnd={() => {
                      setDraggedColumn(null);
                      setDragOverColumn(null);
                    }}
                    onKeyDown={(event) => handleMoveKeyDown(event, column)}
                  >
                    <GripVertical className="size-3.5" aria-hidden />
                  </span>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map(({ task }) => (
            <TableRow key={task.id}>
              {columnOrder.map((column) => (
                <TableCell
                  key={column}
                  className={cn(
                    column === "title" && "font-medium text-neutral-900",
                  )}
                >
                  <TodayCell
                    task={task}
                    column={column}
                    profiles={profiles}
                    taskHref={taskHref(searchParams, task.id)}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TodayCell({
  task,
  column,
  profiles,
  taskHref,
}: {
  task: TodayTask;
  column: TodayColumnId;
  profiles: TodayProfileOption[];
  taskHref: string;
}) {
  switch (column) {
    case "project":
      return (
        <Link
          href={task.project ? `/projects/${task.project.id}` : "/personal"}
          className="inline-flex max-w-52"
        >
          <ProjectBadge
            projectId={task.project?.id}
            name={task.project?.name}
          />
        </Link>
      );
    case "title":
      return (
        <Link href={taskHref} className="hover:underline">
          {task.title}
        </Link>
      );
    case "assignee":
      return (
        <TaskQuickSelect
          taskId={task.id}
          taskTitle={task.title}
          field="assignee_id"
          value={task.assignee_id}
          options={profiles}
        />
      );
    case "priority":
      return (
        <TaskQuickSelect
          taskId={task.id}
          taskTitle={task.title}
          field="priority"
          value={task.priority}
        />
      );
    case "due_date":
      return (
        <TaskDueDateCell
          taskId={task.id}
          taskTitle={task.title}
          dueDate={task.due_date}
          status={task.status}
        />
      );
    case "status":
      return <TaskStatusBadge status={task.status ?? "todo"} />;
    case "done":
      return <TaskDoneCheckbox taskId={task.id} done={false} />;
  }
}

function taskHref(searchParams: URLSearchParams, taskId: string): string {
  const params = new URLSearchParams(searchParams.toString());
  params.set("task", taskId);
  return `/today?${params.toString()}`;
}

function SortIcon({
  sort,
  column,
}: {
  sort: TodayTableSort | null;
  column: TodayColumnId;
}) {
  if (sort?.column !== column) {
    return <ArrowUpDown className="size-3 text-neutral-300" aria-hidden />;
  }

  return sort.direction === "asc" ? (
    <ArrowUp className="size-3 text-neutral-700" aria-hidden />
  ) : (
    <ArrowDown className="size-3 text-neutral-700" aria-hidden />
  );
}

function getAriaSort(
  sort: TodayTableSort | null,
  column: TodayColumnId,
): "ascending" | "descending" | "none" {
  if (sort?.column !== column) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

function normalizeDraggedColumn(value: string): TodayColumnId | null {
  return DEFAULT_TODAY_COLUMN_ORDER.includes(value as TodayColumnId)
    ? (value as TodayColumnId)
    : null;
}

function subscribeToColumnOrder(onStoreChange: () => void): () => void {
  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) onStoreChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(STORAGE_EVENT, onStoreChange);
  };
}

function getColumnOrderSnapshot(): string {
  try {
    return (
      window.localStorage.getItem(STORAGE_KEY) ??
      DEFAULT_COLUMN_ORDER_SNAPSHOT
    );
  } catch {
    return DEFAULT_COLUMN_ORDER_SNAPSHOT;
  }
}

function getDefaultColumnOrderSnapshot(): string {
  return DEFAULT_COLUMN_ORDER_SNAPSHOT;
}

function parseColumnOrderSnapshot(snapshot: string): TodayColumnId[] {
  try {
    return normalizeTodayColumnOrder(JSON.parse(snapshot));
  } catch {
    return [...DEFAULT_TODAY_COLUMN_ORDER];
  }
}
