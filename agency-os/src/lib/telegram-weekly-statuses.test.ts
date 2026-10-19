import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { directionCampaignIds, formatWeeklyStatusMessage, previousFullMoscowWeek, type WeeklyStatusReport } from "./telegram-weekly-statuses";

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

  it("formats an INOM account status with both independent goals", () => {
    const report: WeeklyStatusReport = {
      projectName: "Отчёт ИНОМ (запасной аккаунт fortilda26)", reportUrl: null,
      period: { from: "2026-09-28", to: "2026-10-04" }, errors: [],
      showDirectionHeading: false, spendLabel: "Расход",
      directions: [{ name: "ИНОМ", spend: 5333.08, impressions: 30980, clicks: 396, ctr: 396 / 30980 * 100, contactCpa: null, goals: [
        { label: "Страница «Спасибо»", metricKind: "form", count: 9, cpa: 5333.08 / 9, dates: [], value: null, valueLabel: null, includeInContactCpa: false },
        { label: "CRM: Заказ создан", metricKind: "form", count: 1, cpa: 5333.08, dates: [], value: null, valueLabel: null, includeInContactCpa: false },
      ] }],
    };
    expect(formatWeeklyStatusMessage(report)).toContain("Страница «Спасибо»: 9 / CPA 592,56 ₽");
    expect(formatWeeklyStatusMessage(report)).toContain("CRM: Заказ создан: 1 / CPA 5 333,08 ₽");
    expect(formatWeeklyStatusMessage(report)).toContain("Расход: 5 333,08 ₽");
    expect(formatWeeklyStatusMessage(report)).not.toContain("<b>ИНОМ</b>");
  });

  it("does not mix advertiser accounts or unrelated counters", () => {
    const campaigns = [
      { id: "a", ad_account_id: "fortilda26", metrika_counter_ids: ["109204270"] },
      { id: "b", ad_account_id: "fortilda26", metrika_counter_ids: [] },
      { id: "c", ad_account_id: "other", metrika_counter_ids: ["109204270"] },
      { id: "d", ad_account_id: "fortilda26", metrika_counter_ids: ["999"] },
    ];
    expect([...directionCampaignIds({ counter_id: "109204270", ad_account_id: "fortilda26", include_counterless_campaigns: true }, campaigns)]).toEqual(["a", "b"]);
    expect([...directionCampaignIds({ counter_id: "109204270", ad_account_id: "fortilda26", include_counterless_campaigns: false }, campaigns)]).toEqual(["a"]);
  });
});
