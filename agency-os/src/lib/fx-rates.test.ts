import { describe, expect, it } from "vitest";

import { makeConverter } from "@/lib/fx-rates";

const rates = [
  { date: "2026-10-02", currency: "USD", rub_per_unit: 80 },
  { date: "2026-10-03", currency: "USD", rub_per_unit: 84 },
  { date: "2026-10-03", currency: "AED", rub_per_unit: 22.8 },
];

describe("makeConverter", () => {
  it("converts through rubles at the day's rate", () => {
    expect(makeConverter(rates, "USD")(100, "AED", "2026-10-03")).toBeCloseTo(100 * 22.8 / 84);
    expect(makeConverter(rates, "RUB")(10, "USD", "2026-10-02")).toBe(800);
  });
  it("uses the last published rate for weekends", () => {
    expect(makeConverter(rates, "RUB")(1, "USD", "2026-10-05")).toBe(84);
  });
  it("leaves the display currency untouched and reports unknown currencies", () => {
    expect(makeConverter(rates, "USD")(7, "USD", "2026-10-03")).toBe(7);
    expect(makeConverter(rates, "USD")(7, "XYZ", "2026-10-03")).toBeNull();
  });
  it("never looks forward for a missing historical rate", () => {
    expect(makeConverter(rates, "USD")(100, "AED", "2026-10-02")).toBeNull();
    expect(makeConverter(rates, "RUB")(1, "USD", "2026-10-01")).toBeNull();
  });
  it("ignores zero, negative and non-finite exchange rates", () => {
    for (const rub_per_unit of [0, -1, NaN, Infinity]) {
      expect(makeConverter([{ date: "2026-10-01", currency: "USD", rub_per_unit }], "USD")(80, "RUB", "2026-10-02")).toBeNull();
    }
  });
});
