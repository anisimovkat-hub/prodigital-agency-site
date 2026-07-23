import { describe, expect, it } from "vitest";

import { projectBadgeColors, projectHue } from "@/lib/project-colors";

describe("projectHue", () => {
  it("возвращает стабильный оттенок для одного проекта", () => {
    expect(projectHue("project-alpha")).toBe(projectHue("project-alpha"));
  });

  it("различает проекты и остаётся в диапазоне HSL", () => {
    const first = projectHue("project-alpha");
    const second = projectHue("project-beta");

    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(360);
    expect(first).not.toBe(second);
  });
});

describe("projectBadgeColors", () => {
  it("создаёт читаемую тройку цветов из оттенка проекта", () => {
    const colors = projectBadgeColors("project-alpha");

    expect(colors.backgroundColor).toMatch(/^hsl\(\d+ 75% 93%\)$/);
    expect(colors.borderColor).toMatch(/^hsl\(\d+ 58% 80%\)$/);
    expect(colors.color).toMatch(/^hsl\(\d+ 58% 30%\)$/);
  });
});
