import { describe, expect, it } from "vitest";

import {
  BOARD_COLUMNS,
  buildManualBoardOrder,
  sortBoardTasks,
  sortBoardTasksManually,
  type BoardSortableTask,
} from "@/lib/board-sort";

const TODAY = "2026-08-12";

function task(
  id: string,
  overrides: Partial<BoardSortableTask> = {},
): BoardSortableTask & { id: string } {
  return {
    id,
    due_date: null,
    priority: "medium",
    is_important: false,
    is_urgent: false,
    ...overrides,
  };
}

describe("BOARD_COLUMNS", () => {
  it("показывает паузу перед проверкой", () => {
    expect(BOARD_COLUMNS).toEqual([
      "todo",
      "in_progress",
      "ai_wait",
      "paused",
      "review",
      "done",
    ]);
  });
});

describe("sortBoardTasks", () => {
  it("сначала учитывает сочетание дедлайна и приоритета", () => {
    const input = [
      task("neither", { priority: null }),
      task("priority-only", { priority: "urgent" }),
      task("deadline-only", { priority: null, due_date: TODAY }),
      task("both", { priority: "low", due_date: TODAY }),
    ];

    expect(sortBoardTasks(input, TODAY).map(({ id }) => id)).toEqual([
      "both",
      "deadline-only",
      "priority-only",
      "neither",
    ]);
  });

  it("сортирует по дедлайну и приоритету раньше скрытых флагов", () => {
    const input = [
      task("low", { priority: "low" }),
      task("medium"),
      task("high", { priority: "high" }),
      task("important", { is_important: true, priority: "low" }),
      task("urgent-priority", { priority: "urgent" }),
      task("urgent-flag", { is_urgent: true, priority: "low" }),
      task("today", { due_date: TODAY, priority: "low" }),
      task("overdue", { due_date: "2026-08-10", priority: "low" }),
    ];

    expect(sortBoardTasks(input, TODAY).map(({ id }) => id)).toEqual([
      "overdue",
      "today",
      "urgent-priority",
      "high",
      "medium",
      "urgent-flag",
      "important",
      "low",
    ]);
  });

  it("ставит ближайший дедлайн выше при равных признаках", () => {
    const later = task("later", { due_date: "2026-08-20" });
    const sooner = task("sooner", { due_date: "2026-08-14" });
    const undated = task("undated");

    expect(sortBoardTasks([undated, later, sooner], TODAY).map(({ id }) => id)).toEqual([
      "sooner",
      "later",
      "undated",
    ]);
  });

  it("сохраняет исходный порядок полностью равных задач", () => {
    const input = [task("first"), task("second"), task("third")];

    expect(sortBoardTasks(input, TODAY).map(({ id }) => id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });
});

describe("sortBoardTasksManually", () => {
  it("использует сохранённые позиции в ручном режиме", () => {
    const input = [
      { ...task("urgent", { priority: "urgent" }), board_position: 3_000 },
      { ...task("low", { priority: "low" }), board_position: 1_000 },
      { ...task("medium"), board_position: 2_000 },
    ];

    expect(
      sortBoardTasksManually(input, TODAY).map(({ id }) => id),
    ).toEqual(["low", "medium", "urgent"]);
  });

  it("оставляет новые карточки без позиции после ручного списка", () => {
    const input = [
      { ...task("new", { priority: "urgent" }), board_position: null },
      { ...task("saved", { priority: "low" }), board_position: 1_000 },
    ];

    expect(
      sortBoardTasksManually(input, TODAY).map(({ id }) => id),
    ).toEqual(["saved", "new"]);
  });
});

describe("buildManualBoardOrder", () => {
  const positionedTask = (
    id: string,
    status: "todo" | "in_progress",
    boardPosition: number | null,
  ) => ({
    ...task(id),
    status,
    board_position: boardPosition,
  });

  it("переставляет карточку перед выбранной в той же колонке", () => {
    const tasks = [
      positionedTask("first", "todo", 1_000),
      positionedTask("second", "todo", 2_000),
      positionedTask("third", "todo", 3_000),
    ];

    expect(
      buildManualBoardOrder(tasks, "third", "todo", "second", TODAY),
    ).toEqual(["first", "third", "second"]);
  });

  it("добавляет карточку из другой колонки в конец", () => {
    const tasks = [
      positionedTask("first", "todo", 1_000),
      positionedTask("second", "todo", 2_000),
      positionedTask("moving", "in_progress", 1_000),
    ];

    expect(
      buildManualBoardOrder(tasks, "moving", "todo", undefined, TODAY),
    ).toEqual(["first", "second", "moving"]);
  });

  it("учитывает все карточки колонки, даже если интерфейс отфильтрован", () => {
    const tasks = [
      positionedTask("visible", "todo", 1_000),
      positionedTask("hidden", "todo", 2_000),
      positionedTask("moving", "in_progress", null),
    ];

    expect(
      buildManualBoardOrder(tasks, "moving", "todo", "hidden", TODAY),
    ).toEqual(["visible", "moving", "hidden"]);
  });
});
