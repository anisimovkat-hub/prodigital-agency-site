import { describe, expect, it } from "vitest";

import {
  activeTaskLimitWarning,
  findStaleActiveTaskIds,
  focusDurationSeconds,
} from "@/lib/focus-mode";

describe("activeTaskLimitWarning", () => {
  it("warns on a fourth active task without blocking it", () => {
    expect(
      activeTaskLimitWarning({
        nextStatus: "in_progress",
        activeCount: 3,
        wasActive: false,
      }),
    ).toContain("уже 3 задачи");
  });

  it("does not warn when editing an already active task", () => {
    expect(
      activeTaskLimitWarning({
        nextStatus: "in_progress",
        activeCount: 3,
        wasActive: true,
      }),
    ).toBeNull();
  });

  it("does not count AI waiting as human focus", () => {
    expect(
      activeTaskLimitWarning({
        nextStatus: "ai_wait",
        activeCount: 9,
        wasActive: false,
      }),
    ).toBeNull();
  });
});

describe("findStaleActiveTaskIds", () => {
  it("finds work-in-progress tasks without focus activity in the last day", () => {
    expect(
      findStaleActiveTaskIds({
        tasks: [
          { id: "stale", status: "in_progress" },
          { id: "recent", status: "in_progress" },
          { id: "current", status: "in_progress" },
          { id: "queued", status: "todo" },
        ],
        recentTaskIds: ["recent"],
        currentFocusTaskId: "current",
      }),
    ).toEqual(["stale"]);
  });
});

describe("focusDurationSeconds", () => {
  it("calculates a closed session", () => {
    expect(
      focusDurationSeconds(
        "2026-08-13T08:00:00.000Z",
        "2026-08-13T09:30:00.000Z",
      ),
    ).toBe(5_400);
  });

  it("uses now for an open session", () => {
    expect(
      focusDurationSeconds(
        "2026-08-13T08:00:00.000Z",
        null,
        new Date("2026-08-13T08:02:03.000Z"),
      ),
    ).toBe(123);
  });
});
