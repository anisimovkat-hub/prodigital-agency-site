import { describe, expect, it } from "vitest";

import {
  allocateTaskTime,
  sumRawTaskTime,
  type TaskTimeEntry,
} from "@/lib/time-analytics";

const PERIOD = {
  from: new Date("2026-07-27T09:00:00.000Z"),
  to: new Date("2026-07-27T13:00:00.000Z"),
  now: new Date("2026-07-27T13:00:00.000Z"),
};

function entry(
  overrides: Partial<TaskTimeEntry> & Pick<TaskTimeEntry, "id" | "task_id">,
): TaskTimeEntry {
  return {
    task_title: overrides.task_id,
    task_type: "other",
    workstream: null,
    project_id: "project-a",
    user_id: "user-a",
    started_at: "2026-07-27T09:00:00.000Z",
    ended_at: "2026-07-27T10:00:00.000Z",
    ...overrides,
  };
}

describe("allocateTaskTime", () => {
  it("не удваивает время двух параллельных задач одного сотрудника", () => {
    const result = allocateTaskTime(
      [
        entry({
          id: "one",
          task_id: "task-one",
          ended_at: "2026-07-27T11:00:00.000Z",
        }),
        entry({
          id: "two",
          task_id: "task-two",
          started_at: "2026-07-27T10:00:00.000Z",
          ended_at: "2026-07-27T12:00:00.000Z",
        }),
      ],
      PERIOD,
    );

    expect(result.totalSeconds).toBe(3 * 3_600);
    expect(result.byTaskSeconds.get("task-one")).toBe(1.5 * 3_600);
    expect(result.byTaskSeconds.get("task-two")).toBe(1.5 * 3_600);
    expect(result.rawByTaskSeconds.get("task-one")).toBe(2 * 3_600);
    expect(result.rawByTaskSeconds.get("task-two")).toBe(2 * 3_600);
  });

  it("суммирует параллельную работу разных сотрудников", () => {
    const result = allocateTaskTime(
      [
        entry({ id: "one", task_id: "task-one" }),
        entry({
          id: "two",
          task_id: "task-two",
          user_id: "user-b",
        }),
      ],
      PERIOD,
    );

    expect(result.totalSeconds).toBe(2 * 3_600);
    expect(result.byProjectSeconds.get("project-a")).toBe(2 * 3_600);
  });

  it("обрезает открытый интервал границами периода и текущим временем", () => {
    const result = allocateTaskTime(
      [
        entry({
          id: "open",
          task_id: "task-open",
          started_at: "2026-07-27T08:00:00.000Z",
          ended_at: null,
        }),
      ],
      {
        ...PERIOD,
        now: new Date("2026-07-27T10:30:00.000Z"),
      },
    );

    expect(result.totalSeconds).toBe(1.5 * 3_600);
  });
});

describe("sumRawTaskTime", () => {
  it("считает закрытые и активные интервалы задачи", () => {
    const result = sumRawTaskTime(
      [
        entry({ id: "closed", task_id: "task-one" }),
        entry({
          id: "open",
          task_id: "task-one",
          started_at: "2026-07-27T11:00:00.000Z",
          ended_at: null,
        }),
      ],
      new Date("2026-07-27T12:30:00.000Z"),
    );

    expect(result.get("task-one")).toBe(2.5 * 3_600);
  });
});
