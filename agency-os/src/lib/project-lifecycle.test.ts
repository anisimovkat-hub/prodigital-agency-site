import { describe, expect, it } from "vitest";

import {
  clientStatusFromProjectStages,
  isCurrentProject,
  isOperationalProject,
  isTaskOperational,
} from "@/lib/project-lifecycle";

describe("project lifecycle", () => {
  it("keeps active and paused projects in current views", () => {
    expect(isCurrentProject("active")).toBe(true);
    expect(isCurrentProject("paused")).toBe(true);
    expect(isCurrentProject(null)).toBe(true);
  });

  it("hides finished projects from current views", () => {
    expect(isCurrentProject("finished")).toBe(false);
  });

  it("only treats launching and active projects as operational", () => {
    expect(isOperationalProject("launching")).toBe(true);
    expect(isOperationalProject("active")).toBe(true);
    expect(isOperationalProject(null)).toBe(true);
    expect(isOperationalProject("paused")).toBe(false);
    expect(isOperationalProject("finished")).toBe(false);
  });

  it("keeps personal tasks visible and pauses project tasks with the project", () => {
    expect(isTaskOperational({ project_id: null, project: null })).toBe(true);
    expect(
      isTaskOperational({
        project_id: "project-id",
        project: { stage: "active" },
      }),
    ).toBe(true);
    expect(
      isTaskOperational({
        project_id: "project-id",
        project: { stage: "paused" },
      }),
    ).toBe(false);
    expect(
      isTaskOperational({ project_id: "project-id", project: null }),
    ).toBe(false);
  });

  it("derives a client status from all linked projects", () => {
    expect(clientStatusFromProjectStages(["finished", "active"])).toBe("active");
    expect(clientStatusFromProjectStages(["finished", "paused"])).toBe("paused");
    expect(clientStatusFromProjectStages(["finished"])).toBe("churned");
    expect(clientStatusFromProjectStages([])).toBe("churned");
  });
});
