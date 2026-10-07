import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { formatWeeklyStatusMessage, previousFullMoscowWeek, type WeeklyStatusReport } from "./telegram-weekly-statuses";

describe("telegram weekly advertising statuses", () => {
  it("uses the completed Moscow Monday–Sunday week", () => {
    expect(previousFullMoscowWeek(new Date("2026-10-05T07:00:00.000Z"))).toEqual({ from: "2026-09-28", to: "2026-10-04" });
  });

  it("formats one safe project post without inventing a missing value", () => {
    const report: WeeklyStatusReport = {
      projectName: "Kolvika", reportUrl: "https://docs.google.com/spreadsheets/d/example/edit", period: { from: "2026-09-28", to: "2026-10-04" }, errors: [],
      directions: [{ name: "Gems4U", spend: 2128, impressions: 10000, clicks: 120, ctr: 1.2, contactCpa: null, goals: [
        { label: "Корзина", metricKind: "cart", count: 2, cpa: 1064, dates: ["29.09", "02.10"], value: null, valueLabel: "Стоимость товаров в корзинах", includeInContactCpa: false },
        { label: "Покупка", metricKind: "purchase", count: 0, cpa: null, dates: [], value: 0, valueLabel: "Выручка по покупкам", includeInContactCpa: false },
      ] }],
    };
    expect(formatWeeklyStatusMessage(report)).toBe([
      "<b>Kolvika</b>",
      "<b>28.09.2026–04.10.2026</b>",
      "Отчёт: <a href=\"https://docs.google.com/spreadsheets/d/example/edit\">открыть таблицу</a>",
      "<b>Gems4U</b>\nРасход с НДС: 2 128 ₽\nПоказы: 10 000\nКлики: 120\nCTR: 1,2%\n\nКорзина: 2 (29.09 и 02.10) / CPA 1 064 ₽\nСтоимость товаров в корзинах: —\nПокупка: 0 / —\nВыручка по покупкам: 0 ₽",
    ].join("\n\n"));
  });
});
