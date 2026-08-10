import { describe, expect, it } from "vitest";

import {
  isExpiredPersonalCompletedTask,
  personalCompletedDeleteCutoff,
  sortPersonalTasks,
} from "@/lib/personal-task-order";

const TODAY = "2026-08-10";

function task(
  id: string,
  status: "todo" | "done",
  dueDate: string | null,
  createdAt = "2026-08-01T00:00:00Z",
) {
  return { id, status, due_date: dueDate, created_at: createdAt };
}

describe("personal task retention", () => {
  it("calculates the two-day deadline cutoff", () => {
    expect(personalCompletedDeleteCutoff(TODAY)).toBe("2026-08-08");
  });

  it("expires only completed dated tasks at or before the cutoff", () => {
    expect(isExpiredPersonalCompletedTask(task("old-done", "done", "2026-08-08"), TODAY)).toBe(true);
    expect(isExpiredPersonalCompletedTask(task("recent-done", "done", "2026-08-09"), TODAY)).toBe(false);
    expect(isExpiredPersonalCompletedTask(task("old-open", "todo", "2026-01-01"), TODAY)).toBe(false);
    expect(isExpiredPersonalCompletedTask(task("undated-done", "done", null), TODAY)).toBe(false);
  });
});

describe("sortPersonalTasks", () => {
  it("puts open tasks first and sorts them by the nearest deadline", () => {
    const sorted = sortPersonalTasks([
      task("done", "done", "2026-08-10"),
      task("without-date", "todo", null),
      task("later", "todo", "2026-08-12"),
      task("overdue", "todo", "2026-08-01"),
    ]);

    expect(sorted.map((item) => item.id)).toEqual([
      "overdue",
      "later",
      "without-date",
      "done",
    ]);
  });
});
