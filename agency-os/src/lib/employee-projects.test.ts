import { describe, expect, it } from "vitest";

import { activeProjectIdsByEmployee } from "@/lib/employee-projects";

describe("activeProjectIdsByEmployee", () => {
  it("объединяет ответственного и участника без двойного счёта проекта", () => {
    const result = activeProjectIdsByEmployee(
      [{ id: "project-1", responsible_id: "employee-1", stage: "active" }],
      [
        {
          profile_id: "employee-1",
          project_id: "project-1",
          project: { stage: "active" },
        },
      ],
    );

    expect(result.get("employee-1")).toEqual(new Set(["project-1"]));
  });

  it("учитывает проекты на запуске для ответственных и участников", () => {
    const result = activeProjectIdsByEmployee(
      [
        {
          id: "launch-1",
          responsible_id: "responsible",
          stage: "launching",
        },
      ],
      [
        {
          profile_id: "member",
          project_id: "launch-1",
          project: { stage: "launching" },
        },
      ],
    );

    expect(result.get("responsible")?.size).toBe(1);
    expect(result.get("member")?.size).toBe(1);
  });

  it("не учитывает проекты на паузе и завершённые", () => {
    const result = activeProjectIdsByEmployee(
      [
        { id: "paused", responsible_id: "employee", stage: "paused" },
        { id: "finished", responsible_id: "employee", stage: "finished" },
      ],
      [
        {
          profile_id: "employee",
          project_id: "paused",
          project: { stage: "paused" },
        },
      ],
    );

    expect(result.get("employee")).toBeUndefined();
  });
});
