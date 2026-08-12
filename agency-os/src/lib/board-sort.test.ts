import { describe, expect, it } from "vitest";

import {
  BOARD_COLUMNS,
  sortBoardTasks,
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
      "paused",
      "review",
      "done",
    ]);
  });
});

describe("sortBoardTasks", () => {
  it("сортирует по срочности, важности и приоритету", () => {
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
      "urgent-flag",
      "important",
      "high",
      "medium",
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
