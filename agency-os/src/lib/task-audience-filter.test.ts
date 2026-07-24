import { describe, expect, it } from "vitest";

import { filterTasksByAudience } from "@/lib/task-audience-filter";

const tasks = [
  { id: "mine-project", assignee_id: "me", project_id: "project-1" },
  { id: "mine-personal", assignee_id: "me", project_id: null },
  { id: "team", assignee_id: "colleague", project_id: "project-2" },
  { id: "unassigned", assignee_id: null, project_id: "project-3" },
];

describe("filterTasksByAudience", () => {
  it("returns all tasks without a filter", () => {
    expect(filterTasksByAudience(tasks, { userId: "me" })).toEqual(tasks);
  });

  it("returns tasks assigned to the current user", () => {
    expect(
      filterTasksByAudience(tasks, { userId: "me", who: "mine" }).map(
        (task) => task.id,
      ),
    ).toEqual(["mine-project", "mine-personal"]);
  });

  it("returns all personal tasks available through RLS", () => {
    expect(
      filterTasksByAudience(tasks, { userId: "me", who: "personal" }).map(
        (task) => task.id,
      ),
    ).toEqual(["mine-personal"]);
  });

  it("returns assigned team tasks but not unassigned tasks", () => {
    expect(
      filterTasksByAudience(tasks, { userId: "me", who: "team" }).map(
        (task) => task.id,
      ),
    ).toEqual(["team"]);
  });

  it("gives an explicit employee priority over the audience tab", () => {
    expect(
      filterTasksByAudience(tasks, {
        userId: "me",
        who: "mine",
        assigneeId: "colleague",
      }).map((task) => task.id),
    ).toEqual(["team"]);
  });
});
