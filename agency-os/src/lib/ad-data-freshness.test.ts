import { describe, expect, it } from "vitest";

import { describeAdDataFreshness } from "@/lib/ad-data-freshness";

describe("describeAdDataFreshness", () => {
  it("предупреждает, когда данных нет совсем", () => {
    expect(
      describeAdDataFreshness({
        latestDate: null,
        from: "2026-08-01",
        to: "2026-08-12",
      }),
    ).toContain("ещё не загружены");
  });

  it("объясняет нули, если выбранный период позже последних данных", () => {
    expect(
      describeAdDataFreshness({
        latestDate: "2026-07-28",
        from: "2026-08-01",
        to: "2026-08-12",
      }),
    ).toContain("нулевые значения");
  });

  it("предупреждает о частично устаревшем диапазоне", () => {
    expect(
      describeAdDataFreshness({
        latestDate: "2026-08-05",
        from: "2026-08-01",
        to: "2026-08-12",
      }),
    ).toContain("отстают на 7 дн.");
  });

  it("не тревожит, если данные доходят до конца периода с допуском в сутки", () => {
    expect(
      describeAdDataFreshness({
        latestDate: "2026-08-11",
        from: "2026-08-01",
        to: "2026-08-12",
      }),
    ).toBeNull();
  });
});
