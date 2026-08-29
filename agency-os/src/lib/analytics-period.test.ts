import { describe, expect, it } from "vitest";

import {
  previousMonthPeriod,
  previousWeekPeriod,
  lastDaysPeriod,
  parseAnalyticsPeriod,
  periodPresetFor,
  thisMonthPeriod,
  thisWeekPeriod,
  todayPeriod,
  yesterdayPeriod,
} from "@/lib/analytics-period";

const TODAY = new Date("2026-08-29T12:00:00.000Z");

describe("analytics periods", () => {
  it("считает быстрый период включительно", () => {
    expect(lastDaysPeriod(TODAY, 7)).toEqual({
      from: "2026-08-23",
      to: "2026-08-29",
    });
    expect(lastDaysPeriod(TODAY, 30)).toEqual({
      from: "2026-07-31",
      to: "2026-08-29",
    });
  });

  it("распознаёт быстрый период и оставляет точный диапазон произвольным", () => {
    expect(periodPresetFor(lastDaysPeriod(TODAY, 14), TODAY)).toBe(14);
    expect(periodPresetFor({ from: "2026-08-17", to: "2026-08-29" }, TODAY)).toBeNull();
  });

  it("создаёт календарные периоды для меню выбора", () => {
    expect(todayPeriod(TODAY)).toEqual({ from: "2026-08-29", to: "2026-08-29" });
    expect(yesterdayPeriod(TODAY)).toEqual({ from: "2026-08-28", to: "2026-08-28" });
    expect(thisWeekPeriod(TODAY)).toEqual({ from: "2026-08-24", to: "2026-08-29" });
    expect(previousWeekPeriod(TODAY)).toEqual({ from: "2026-08-17", to: "2026-08-23" });
    expect(thisMonthPeriod(TODAY)).toEqual({ from: "2026-08-01", to: "2026-08-29" });
    expect(previousMonthPeriod(TODAY)).toEqual({ from: "2026-07-01", to: "2026-07-31" });
  });

  it("принимает только корректный диапазон до 365 дней", () => {
    expect(parseAnalyticsPeriod({ from: "2026-08-17", to: "2026-08-29" }, TODAY)).toEqual({
      from: "2026-08-17",
      to: "2026-08-29",
    });
    expect(parseAnalyticsPeriod({ from: "2026-08-30", to: "2026-08-29" }, TODAY)).toBeNull();
    expect(parseAnalyticsPeriod({ from: "2025-08-29", to: "2026-08-29" }, TODAY)).toBeNull();
  });
});
