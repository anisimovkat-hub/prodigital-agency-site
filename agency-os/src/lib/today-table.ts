import type { Enums } from "@/lib/supabase/types";

export const DEFAULT_TODAY_COLUMN_ORDER = [
  "project",
  "title",
  "assignee",
  "priority",
  "due_date",
  "status",
  "done",
] as const;

export type TodayColumnId = (typeof DEFAULT_TODAY_COLUMN_ORDER)[number];
export type SortDirection = "asc" | "desc";

export type TodayTableSort = {
  column: TodayColumnId;
  direction: SortDirection;
};

export type TodayTableSortableRow = {
  title: string;
  projectName: string | null;
  assigneeName: string | null;
  priority: Enums<"task_priority"> | null;
  dueDate: string | null;
  status: Enums<"task_status"> | null;
  done: boolean;
};

const PRIORITY_ORDER: Record<Enums<"task_priority">, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

const STATUS_ORDER: Record<Enums<"task_status">, number> = {
  backlog: 1,
  todo: 2,
  in_progress: 3,
  review: 4,
  paused: 5,
  done: 6,
};

export function normalizeTodayColumnOrder(value: unknown): TodayColumnId[] {
  if (!Array.isArray(value) || value.length !== DEFAULT_TODAY_COLUMN_ORDER.length) {
    return [...DEFAULT_TODAY_COLUMN_ORDER];
  }

  const allowed = new Set<string>(DEFAULT_TODAY_COLUMN_ORDER);
  const unique = new Set(value);
  const isValid = value.every(
    (column): column is TodayColumnId =>
      typeof column === "string" && allowed.has(column),
  );

  return isValid && unique.size === DEFAULT_TODAY_COLUMN_ORDER.length
    ? [...value]
    : [...DEFAULT_TODAY_COLUMN_ORDER];
}

export function moveTodayColumn(
  order: TodayColumnId[],
  source: TodayColumnId,
  target: TodayColumnId,
): TodayColumnId[] {
  if (source === target) return [...order];

  const sourceIndex = order.indexOf(source);
  const targetIndex = order.indexOf(target);
  if (sourceIndex === -1 || targetIndex === -1) return [...order];

  const next = [...order];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

export function sortTodayTableRows<T extends TodayTableSortableRow>(
  rows: T[],
  sort: TodayTableSort | null,
): T[] {
  if (!sort) return [...rows];

  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const aMissing = isMissingValue(a.row, sort.column);
      const bMissing = isMissingValue(b.row, sort.column);
      if (aMissing !== bMissing) return aMissing ? 1 : -1;

      const compared = compareRows(a.row, b.row, sort.column);
      if (compared === 0) return a.index - b.index;
      return sort.direction === "asc" ? compared : -compared;
    })
    .map(({ row }) => row);
}

function compareRows(
  a: TodayTableSortableRow,
  b: TodayTableSortableRow,
  column: TodayColumnId,
): number {
  switch (column) {
    case "project":
      return compareNullable(a.projectName, b.projectName, compareText);
    case "title":
      return compareText(a.title, b.title);
    case "assignee":
      return compareNullable(a.assigneeName, b.assigneeName, compareText);
    case "priority":
      return compareNullable(
        a.priority,
        b.priority,
        (left, right) => PRIORITY_ORDER[left] - PRIORITY_ORDER[right],
      );
    case "due_date":
      return compareNullable(a.dueDate, b.dueDate, (left, right) =>
        left.localeCompare(right),
      );
    case "status":
      return compareNullable(
        a.status,
        b.status,
        (left, right) => STATUS_ORDER[left] - STATUS_ORDER[right],
      );
    case "done":
      return Number(a.done) - Number(b.done);
  }
}

function isMissingValue(
  row: TodayTableSortableRow,
  column: TodayColumnId,
): boolean {
  switch (column) {
    case "project":
      return row.projectName === null;
    case "assignee":
      return row.assigneeName === null;
    case "priority":
      return row.priority === null;
    case "due_date":
      return row.dueDate === null;
    case "status":
      return row.status === null;
    case "title":
    case "done":
      return false;
  }
}

function compareNullable<T>(
  a: T | null,
  b: T | null,
  compare: (left: T, right: T) => number,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compare(a, b);
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "ru", { sensitivity: "base" });
}
