import { describe, expect, it } from "vitest";

import {
  completedTasksDeleteBefore,
  completedTasksVisibleSince,
} from "@/lib/task-retention";

describe("task retention", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");

  it("shows completed tasks for 30 days", () => {
    expect(completedTasksVisibleSince(now).toISOString()).toBe(
      "2026-06-24T12:00:00.000Z",
    );
  });

  it("deletes completed tasks after 60 days", () => {
    expect(completedTasksDeleteBefore(now).toISOString()).toBe(
      "2026-05-25T12:00:00.000Z",
    );
  });
});
