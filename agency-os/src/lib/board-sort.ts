import { todayISO } from "@/lib/format";
import type { Enums } from "@/lib/supabase/types";

export const BOARD_COLUMNS: Enums<"task_status">[] = [
  "todo",
  "in_progress",
  "ai_wait",
  "paused",
  "review",
  "done",
];

export type BoardSortableTask = {
  due_date: string | null;
  priority: Enums<"task_priority"> | null;
  is_important: boolean | null;
  is_urgent: boolean | null;
};

export type ManuallySortableBoardTask = BoardSortableTask & {
  board_position: number | null;
};

export type BoardPositionedTask = ManuallySortableBoardTask & {
  id: string;
  status: Enums<"task_status"> | null;
};

const PRIORITY_ORDER: Record<Enums<"task_priority">, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function signalsBucket(task: BoardSortableTask): number {
  if (task.due_date && task.priority) return 0;
  if (task.due_date) return 1;
  if (task.priority) return 2;
  return 3;
}

function deadlineBucket(task: BoardSortableTask, today: string): number {
  if (task.due_date && task.due_date < today) return 0;
  if (task.due_date === today) return 1;
  if (task.due_date) return 2;
  return 3;
}

function compareSmartOrder(
  a: BoardSortableTask,
  b: BoardSortableTask,
  today: string,
): number {
  const signalsDiff = signalsBucket(a) - signalsBucket(b);
  if (signalsDiff !== 0) return signalsDiff;

  const deadlineDiff = deadlineBucket(a, today) - deadlineBucket(b, today);
  if (deadlineDiff !== 0) return deadlineDiff;

  const priorityDiff =
    PRIORITY_ORDER[a.priority ?? "medium"] -
    PRIORITY_ORDER[b.priority ?? "medium"];
  if (priorityDiff !== 0) return priorityDiff;

  const urgentDiff = Number(Boolean(b.is_urgent)) - Number(Boolean(a.is_urgent));
  if (urgentDiff !== 0) return urgentDiff;

  const importanceDiff =
    Number(Boolean(b.is_important)) - Number(Boolean(a.is_important));
  if (importanceDiff !== 0) return importanceDiff;

  if (!a.due_date && !b.due_date) return 0;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date.localeCompare(b.due_date);
}

/**
 * Рабочая очередь доски: задачи с дедлайном и приоритетом → только с
 * дедлайном → только с приоритетом. Внутри группы учитываются просрочка,
 * сегодняшний срок, уровень приоритета, важность и ближайшая дата.
 */
export function sortBoardTasks<T extends BoardSortableTask>(
  tasks: T[],
  today = todayISO(),
): T[] {
  return [...tasks].sort((a, b) => compareSmartOrder(a, b, today));
}

/** Сохранённая позиция имеет приоритет только в явном ручном режиме. */
export function sortBoardTasksManually<T extends ManuallySortableBoardTask>(
  tasks: T[],
  today = todayISO(),
): T[] {
  return [...tasks].sort((a, b) => {
    if (a.board_position != null && b.board_position != null) {
      const positionDiff = a.board_position - b.board_position;
      if (positionDiff !== 0) return positionDiff;
    } else if (a.board_position != null) {
      return -1;
    } else if (b.board_position != null) {
      return 1;
    }

    return compareSmartOrder(a, b, today);
  });
}

/**
 * Возвращает полный новый порядок целевой колонки. Полный список важен:
 * сервер перенумеровывает все доступные карточки колонки одной транзакцией,
 * поэтому фильтры доски не должны терять скрытые карточки.
 */
export function buildManualBoardOrder<T extends BoardPositionedTask>(
  tasks: T[],
  movedTaskId: string,
  targetStatus: Enums<"task_status">,
  beforeTaskId?: string,
  today = todayISO(),
): string[] {
  const orderedIds = sortBoardTasksManually(
    tasks.filter(
      (task) =>
        task.id !== movedTaskId &&
        (task.status ?? "todo") === targetStatus,
    ),
    today,
  ).map((task) => task.id);
  const insertionIndex = beforeTaskId
    ? orderedIds.indexOf(beforeTaskId)
    : orderedIds.length;

  orderedIds.splice(
    insertionIndex < 0 ? orderedIds.length : insertionIndex,
    0,
    movedTaskId,
  );
  return orderedIds;
}
