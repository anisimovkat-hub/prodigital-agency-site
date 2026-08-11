import { describe, expect, it } from "vitest";

import {
  compactInstagramErrors,
  instagramPermissionHint,
} from "@/lib/instagram-diagnostics";

describe("instagramPermissionHint", () => {
  it("не выдаёт ложный диагноз, если список прав недоступен", () => {
    expect(instagramPermissionHint([])).toBeNull();
  });

  it("показывает недостающие insights и discovery-права", () => {
    expect(instagramPermissionHint([
      { permission: "instagram_basic", status: "granted" },
      { permission: "pages_read_engagement", status: "granted" },
    ])).toContain("instagram_manage_insights");
    expect(instagramPermissionHint([
      { permission: "instagram_basic", status: "granted" },
      { permission: "pages_read_engagement", status: "granted" },
    ])).toContain("pages_show_list");
  });

  it("принимает Business Manager как альтернативный путь поиска", () => {
    expect(instagramPermissionHint([
      { permission: "instagram_basic", status: "granted" },
      { permission: "instagram_manage_insights", status: "granted" },
      { permission: "pages_read_engagement", status: "granted" },
      { permission: "business_management", status: "granted" },
    ])).toBeNull();
  });
});

describe("compactInstagramErrors", () => {
  it("убирает дубли и ограничивает длинное сообщение", () => {
    expect(compactInstagramErrors(["A", "A", "B", "C"])).toBe("A; B; ещё 1");
  });
});
