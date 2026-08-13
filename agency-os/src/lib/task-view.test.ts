import { describe, expect, it } from "vitest";

import {
  normalizeTaskView,
  taskViewForPath,
  taskViewHref,
} from "@/lib/task-view";

describe("task views", () => {
  it("сопоставляет старые маршруты единому переключателю", () => {
    expect(taskViewForPath("/today")).toBe("day");
    expect(taskViewForPath("/week")).toBe("weeks");
    expect(taskViewForPath("/tasks?view=completed")).toBe("list");
  });

  it("не принимает испорченное сохранённое значение", () => {
    expect(normalizeTaskView("weeks")).toBe("weeks");
    expect(normalizeTaskView("unknown")).toBe("day");
    expect(normalizeTaskView(null)).toBe("day");
  });

  it("сохраняет аудиторию при смене вида", () => {
    expect(taskViewHref("weeks", { who: "mine", assignee: "u1" })).toBe(
      "/week?who=mine&assignee=u1",
    );
  });
});
