import { describe, expect, it } from "vitest";

import { analyticsSectionHref, marketingSection } from "@/lib/marketing-sections";

describe("marketingSection", () => {
  it.each(["overview", "content", "ads"])("accepts %s", (section) => {
    expect(marketingSection(section)).toBe(section);
  });

  it("keeps old links working", () => {
    expect(marketingSection(undefined, "organic")).toBe("content");
    expect(marketingSection(undefined, "ads")).toBe("ads");
  });

  it("falls back to the overview", () => {
    expect(marketingSection("unknown")).toBe("overview");
    expect(marketingSection("audience")).toBe("overview");
  });
});

describe("analyticsSectionHref", () => {
  it.each(["overview", "content", "ads"] as const)("preserves all report context when selecting %s", (section) => {
    const href = analyticsSectionHref("?project=p1&from=2026-09-01&to=2026-09-30&account=a1&campaign=c1&goal=lead&social=s1&cur=RUB&gran=week&view=organic", section);
    const params = new URL(href, "https://example.com").searchParams;
    expect(Object.fromEntries(params)).toEqual({ project: "p1", from: "2026-09-01", to: "2026-09-30", account: "a1", campaign: "c1", goal: "lead", social: "s1", cur: "RUB", gran: "week", section });
  });
});
