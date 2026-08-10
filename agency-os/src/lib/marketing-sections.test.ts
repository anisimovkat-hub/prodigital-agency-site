import { describe, expect, it } from "vitest";

import { marketingSection } from "@/lib/marketing-sections";

describe("marketingSection", () => {
  it.each(["overview", "content", "ads", "audience"])("accepts %s", (section) => {
    expect(marketingSection(section)).toBe(section);
  });

  it("keeps old links working", () => {
    expect(marketingSection(undefined, "organic")).toBe("content");
    expect(marketingSection(undefined, "ads")).toBe("ads");
  });

  it("falls back to the overview", () => {
    expect(marketingSection("unknown")).toBe("overview");
  });
});
