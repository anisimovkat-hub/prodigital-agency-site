import { describe, expect, it } from "vitest";

import {
  completedTaskRetentionCutoffDate,
  isCompletedTaskVisible,
} from "@/lib/task-retention";

describe("task retention", () => {
  const now = new Date("2026-08-14T04:00:00.000Z");

  it("uses calendar dates instead of an exact 72-hour interval", () => {
    expect(completedTaskRetentionCutoffDate(now)).toBe("2026-08-11");
  });

  it("hides a task completed three calendar days ago", () => {
    expect(isCompletedTaskVisible("2026-08-11T07:06:27.390Z", now)).toBe(
      false,
    );
  });

  it("keeps tasks from the two previous calendar dates and today", () => {
    expect(isCompletedTaskVisible("2026-08-12T00:01:00.000Z", now)).toBe(true);
    expect(isCompletedTaskVisible("2026-08-14T03:30:00.000Z", now)).toBe(true);
  });

  it("does not keep broken done rows without completed_at forever", () => {
    expect(isCompletedTaskVisible(null, now)).toBe(false);
  });
});
