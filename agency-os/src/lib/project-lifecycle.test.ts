import { describe, expect, it } from "vitest";

import {
  clientStatusFromProjectStages,
  isCurrentProject,
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

  it("derives a client status from all linked projects", () => {
    expect(clientStatusFromProjectStages(["finished", "active"])).toBe("active");
    expect(clientStatusFromProjectStages(["finished", "paused"])).toBe("paused");
    expect(clientStatusFromProjectStages(["finished"])).toBe("churned");
    expect(clientStatusFromProjectStages([])).toBe("churned");
  });
});
