import { describe, expect, it } from "vitest";

import { sortProjectsForDisplay } from "@/lib/project-order";

describe("sortProjectsForDisplay", () => {
  it("puts launch work first and paused projects below active work", () => {
    const sorted = sortProjectsForDisplay([
      { name: "Blossom", stage: "paused" as const },
      { name: "Альма", stage: "active" as const },
      { name: "Новый проект", stage: "launching" as const },
    ]);

    expect(sorted.map((project) => project.name)).toEqual([
      "Новый проект",
      "Альма",
      "Blossom",
    ]);
  });
});
