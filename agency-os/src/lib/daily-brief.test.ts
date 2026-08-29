import { describe, expect, it } from "vitest";

import {
  buildDailyBrief,
  type DailyBriefTask,
} from "@/lib/daily-brief";

const tasks = [
  task("overdue", { due_date: "2026-08-12", priority: "high" }),
  task("today", { due_date: "2026-08-13" }),
  task("urgent", { due_date: "2026-08-20", is_urgent: true }),
  task("later", { due_date: "2026-08-21" }),
  task("personal-later", { project_id: null, due_date: "2026-08-22" }),
  task("colleague-task", { assignee_id: "colleague" }),
];

describe("buildDailyBrief", () => {
  it("separates overdue, today and urgent without duplicates", () => {
    const brief = makeBrief();

    expect(brief.overdue.map((item) => item.id)).toEqual(["overdue"]);
    expect(brief.today.map((item) => item.id)).toEqual(["today"]);
    expect(brief.urgent.map((item) => item.id)).toEqual(["urgent"]);
    expect(brief.focus.map((item) => item.id)).toEqual([
      "overdue",
      "today",
      "urgent",
    ]);
  });

  it("suggests only project tasks outside the top three to a free colleague", () => {
    const brief = makeBrief();

    expect(brief.delegationSuggestions).toHaveLength(1);
    expect(brief.delegationSuggestions[0].task.id).toBe("later");
    expect(brief.delegationSuggestions[0].suggestedProfile.id).toBe(
      "colleague",
    );
  });

  it("does not suggest delegation for a specialist", () => {
    expect(makeBrief(false).delegationSuggestions).toEqual([]);
  });

  it("ignores completed tasks", () => {
    const brief = buildDailyBrief({
      tasks: [task("done", { status: "done", due_date: "2026-08-12" })],
      profiles: [],
      userId: "owner",
      today: "2026-08-13",
      allowDelegation: true,
    });

    expect(brief.focus).toEqual([]);
  });
});


function makeBrief(allowDelegation = true) {
  return buildDailyBrief({
    tasks,
    profiles: [
      { id: "owner", full_name: "Катерина" },
      { id: "colleague", full_name: "Инна" },
    ],
    userId: "owner",
    today: "2026-08-13",
    allowDelegation,
  });
}

function task(
  id: string,
  overrides: Partial<DailyBriefTask> = {},
): DailyBriefTask {
  return {
    id,
    title: id,
    assignee_id: "owner",
    project_id: "project",
    status: "todo",
    due_date: null,
    priority: "medium",
    is_important: false,
    is_urgent: false,
    ...overrides,
  };
}
