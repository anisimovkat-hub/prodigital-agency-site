import { describe, expect, it } from "vitest";

import { projectLogoUrl, PROJECT_LOGO_BY_ID } from "@/lib/project-logos";

describe("projectLogoUrl", () => {
  it("возвращает локальный логотип известного проекта", () => {
    expect(projectLogoUrl("d6c28a21-dbe6-478f-a30e-e02ffc2a08be")).toBe(
      "/project-logos/polaris.svg",
    );
  });

  it("отдаёт приоритет логотипу, указанному в базе", () => {
    expect(
      projectLogoUrl(
        "d6c28a21-dbe6-478f-a30e-e02ffc2a08be",
        "https://cdn.example.com/current-logo.png",
      ),
    ).toBe("https://cdn.example.com/current-logo.png");
  });

  it("возвращает null для неизвестного проекта", () => {
    expect(projectLogoUrl("unknown-project")).toBeNull();
    expect(Object.keys(PROJECT_LOGO_BY_ID).length).toBeGreaterThan(0);
  });
});
