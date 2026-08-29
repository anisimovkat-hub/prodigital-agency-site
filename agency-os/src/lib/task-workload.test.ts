import { describe, expect, it } from "vitest";

import { activeTaskLimitWarning } from "@/lib/task-workload";

describe("activeTaskLimitWarning", () => {
  it("предупреждает при запуске четвёртой задачи", () => {
    expect(
      activeTaskLimitWarning({
        nextStatus: "in_progress",
        activeCount: 3,
        wasActive: false,
      }),
    ).toContain("3 задачи");
  });

  it("не предупреждает, когда задача уже была в работе", () => {
    expect(
      activeTaskLimitWarning({
        nextStatus: "in_progress",
        activeCount: 3,
        wasActive: true,
      }),
    ).toBeNull();
  });
});
