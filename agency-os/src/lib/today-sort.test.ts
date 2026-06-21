import { describe, expect, it } from "vitest";

import { sortTodayTasks, taskBucket, type TodaySortableTask } from "@/lib/today-sort";

const TODAY = "2026-06-21";

function task(
  id: string,
  overrides: Partial<TodaySortableTask> = {},
): TodaySortableTask & { id: string } {
  return {
    id,
    due_date: null,
    priority: "medium",
    is_important: false,
    ...overrides,
  };
}

describe("taskBucket", () => {
  it("bucket 1: overdue (due_date в прошлом)", () => {
    const t = task("overdue", { due_date: "2026-06-10" });
    expect(taskBucket(t, TODAY)).toBe(1);
  });

  it("bucket 2: дедлайн сегодня", () => {
    const t = task("due-today", { due_date: TODAY });
    expect(taskBucket(t, TODAY)).toBe(2);
  });

  it("bucket 3: urgent (без сегодняшнего/просроченного дедлайна)", () => {
    const t = task("urgent", { priority: "urgent", due_date: "2026-07-01" });
    expect(taskBucket(t, TODAY)).toBe(3);
  });

  it("bucket 4: important", () => {
    const t = task("important", { is_important: true });
    expect(taskBucket(t, TODAY)).toBe(4);
  });

  it("bucket 5: high priority", () => {
    const t = task("high", { priority: "high" });
    expect(taskBucket(t, TODAY)).toBe(5);
  });

  it("bucket 6: всё остальное", () => {
    const t = task("other", { priority: "low" });
    expect(taskBucket(t, TODAY)).toBe(6);
  });
});

describe("sortTodayTasks", () => {
  it("сортирует строго по правилу: просрочено → сегодня → urgent → important → high → остальное", () => {
    const overdue = task("overdue", { due_date: "2026-06-10" });
    const dueToday = task("due-today", { due_date: TODAY });
    const urgent = task("urgent", {
      priority: "urgent",
      due_date: "2026-07-01",
    });
    const important = task("important", { is_important: true });
    const high = task("high", { priority: "high" });
    const other = task("other", { priority: "low" });

    // Намеренно перемешанный входной порядок.
    const input = [other, high, important, urgent, dueToday, overdue];

    const sorted = sortTodayTasks(input, TODAY);

    expect(sorted.map((t) => t.id)).toEqual([
      "overdue",
      "due-today",
      "urgent",
      "important",
      "high",
      "other",
    ]);
  });

  it("внутри одного бакета сортирует по дате дедлайна по возрастанию", () => {
    const overdueLate = task("overdue-late", { due_date: "2026-06-15" });
    const overdueEarly = task("overdue-early", { due_date: "2026-06-01" });

    const sorted = sortTodayTasks([overdueLate, overdueEarly], TODAY);

    expect(sorted.map((t) => t.id)).toEqual(["overdue-early", "overdue-late"]);
  });

  it("задачи без дедлайна в одном бакете не переставляются местами (стабильная сортировка)", () => {
    const a = task("a", { priority: "low" });
    const b = task("b", { priority: "low" });
    const c = task("c", { priority: "low" });

    const sorted = sortTodayTasks([a, b, c], TODAY);

    expect(sorted.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("задачи без дедлайна сортируются после задач с дедлайном в том же бакете", () => {
    const withDate = task("with-date", { priority: "high", due_date: "2026-07-05" });
    const withoutDate = task("without-date", { priority: "high" });

    const sorted = sortTodayTasks([withoutDate, withDate], TODAY);

    expect(sorted.map((t) => t.id)).toEqual(["with-date", "without-date"]);
  });
});
