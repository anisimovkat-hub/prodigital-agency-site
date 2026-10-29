import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { collectWeeklyPages, directionCampaignIds, formatWeeklyOwnerPreview, formatWeeklyStatusMessage, goalCounterVerified, previousFullMoscowWeek, summarizeDirection, uncoveredWeeklyCampaigns, weeklyScheduleMatches, type WeeklyStatusReport } from "./telegram-weekly-statuses";

describe("telegram weekly advertising statuses", () => {
  it("reads all pages when a week's conversions exceed Supabase's row limit", async () => {
    const pages = [[...Array.from({ length: 1000 }, (_, index) => index)], [1000, 1001]];
    const fetchPage = vi.fn(async () => ({ data: pages.shift() ?? [], error: null }));
    expect(await collectWeeklyPages(fetchPage)).toHaveLength(1002);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 999);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("uses the completed Moscow Monday–Sunday week", () => {
    expect(previousFullMoscowWeek(new Date("2026-10-05T07:00:00.000Z"))).toEqual({ from: "2026-09-28", to: "2026-10-04" });
  });

  it("keeps the owner's 08:00 Moscow slot separate from staff's 10:00 slot", () => {
    expect(weeklyScheduleMatches("0 5 * * 1", new Date("2026-10-26T05:00:00.000Z"))).toBe(true);
    expect(weeklyScheduleMatches("0 5 * * 1", new Date("2026-10-26T05:03:00.000Z"))).toBe(true);
    expect(weeklyScheduleMatches("0 5 * * 1", new Date("2026-10-26T05:59:00.000Z"))).toBe(true);
    expect(weeklyScheduleMatches("0 5 * * 1", new Date("2026-10-26T06:00:00.000Z"))).toBe(false);
    expect(weeklyScheduleMatches("0 7 * * 1", new Date("2026-10-26T05:00:00.000Z"))).toBe(false);
    expect(weeklyScheduleMatches("0 5 * * 1", new Date("2026-10-26T07:00:00.000Z"))).toBe(false);
    expect(weeklyScheduleMatches("0 5 * * 1", new Date("2026-10-27T05:00:00.000Z"))).toBe(false);
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

  it("shows a dash, not missing data, for zero verified contacts", () => {
    const report: WeeklyStatusReport = {
      projectName: "Kolvika", reportUrl: null, period: { from: "2026-10-12", to: "2026-10-18" }, errors: [],
      directions: [{ name: "AI-лендинги", spend: 100, impressions: 1000, clicks: 20, ctr: 2, contactCpa: null,
        contactCpaMissing: false, goals: [{ label: "Отправка формы", metricKind: "form", count: 0, cpa: null, dates: [], value: null, valueLabel: null, includeInContactCpa: true }] }],
    };
    expect(formatWeeklyStatusMessage(report)).toContain("Средний CPA обращений (сумма контактных действий, без дедупликации): —");
  });

  const direction = { id: "d", scenario_id: "s", project_direction_id: null, name: "ИНОМ / fortilda26", channel: "yandex_direct", counter_id: "109204270", ad_account_id: "account-1", include_counterless_campaigns: true, campaign_ids: ["campaign-1"], campaign_name_prefix: null, require_vat: true, allow_no_goals: false, spend_label: null, fallback_match: null, sort_order: 0, is_active: true };
  const goal = { id: "g", direction_id: "d", goal_id: "559741388", action_type: "yandex_goal:559741388:LC", business_label: "Страница «Спасибо»", metric_kind: "form" as const, value_label: null, include_in_contact_cpa: false, sort_order: 0, is_active: true };

  it("preserves verified zero spend with clicks and zero CPA", () => {
    const errors: string[] = [];
    const report = summarizeDirection(direction, [goal], [{ id: "campaign-1", name: "МК", ad_account_id: "account-1", metrika_counter_ids: [] }],
      [{ campaign_id: "campaign-1", date: "2026-10-19", spend: 0, impressions: 100, clicks: 3, spend_includes_vat: true }],
      [{ campaign_id: "campaign-1", date: "2026-10-19", action_type: goal.action_type, count: 1, value: 0, is_measured: true, value_is_measured: false }], errors);
    expect(report).toMatchObject({ spend: 0, impressions: 100, clicks: 3, goals: [{ count: 1, cpa: 0 }] });
    expect(errors).toEqual([]);
  });

  it("keeps missing mandatory metrics distinct from confirmed zero", () => {
    const errors: string[] = [];
    const report = summarizeDirection(direction, [goal], [{ id: "campaign-1", name: "МК", ad_account_id: "account-1", metrika_counter_ids: [] }],
      [{ campaign_id: "campaign-1", date: "2026-10-19", spend: null, impressions: null, clicks: null, spend_includes_vat: false }],
      [{ campaign_id: "campaign-1", date: "2026-10-19", action_type: goal.action_type, count: 0, value: 0, is_measured: false, value_is_measured: false }], errors);
    expect(report).toMatchObject({ spend: null, impressions: null, clicks: null, goals: [{ count: null, cpa: null }] });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("flags Kolvika Tools traffic missing from the direction assignment", () => {
    const errors: string[] = [];
    const report = summarizeDirection({ ...direction, name: "Kolvika Tools", counter_id: "71291494", project_direction_id: "tools", campaign_ids: [] }, [],
      [{ id: "old", name: "kolvika_tmk_tools_rf", ad_account_id: "account-1", metrika_counter_ids: [] }, { id: "new", name: "kolvika_tmk_tools_rf 08.10", ad_account_id: "account-1", metrika_counter_ids: [] }],
      [{ campaign_id: "new", date: "2026-10-19", spend: 0, impressions: 18596, clicks: 618, spend_includes_vat: true }], [], errors,
      undefined, { id: "tools", is_active: true, counter_ids: ["71291494"], campaign_ids: ["old"] });
    expect(report.spend).toBeNull();
    expect(errors.join(" ")).toContain("kolvika_tmk_tools_rf 08.10");
  });

  it("does not mix advertiser accounts or unrelated counters", () => {
    const campaigns = [
      { id: "a", name: "A", ad_account_id: "fortilda26", metrika_counter_ids: ["109204270"] },
      { id: "b", name: "B", ad_account_id: "fortilda26", metrika_counter_ids: [] },
      { id: "c", name: "C", ad_account_id: "other", metrika_counter_ids: ["109204270"] },
      { id: "d", name: "D", ad_account_id: "fortilda26", metrika_counter_ids: ["999"] },
      { id: "e", name: "E", ad_account_id: "fortilda26", metrika_counter_ids: ["109204270", "999"] },
    ];
    expect([...directionCampaignIds({ counter_id: "109204270", ad_account_id: "fortilda26", include_counterless_campaigns: true }, campaigns)]).toEqual(["a"]);
    expect([...directionCampaignIds({ counter_id: "109204270", ad_account_id: "fortilda26", include_counterless_campaigns: false }, campaigns)]).toEqual(["a"]);
    expect([...directionCampaignIds({ counter_id: "109204270", ad_account_id: "fortilda26", include_counterless_campaigns: false }, campaigns, new Set(["a", "d"]))]).toEqual(["a"]);
    expect([...directionCampaignIds({ counter_id: "109204270", ad_account_id: "fortilda26", include_counterless_campaigns: true }, campaigns, new Set(["a", "b", "c", "d", "e"]))]).toEqual(["a", "b", "e"]);
  });

  it("requires a verified goal-to-counter mapping, including CRM goals", () => {
    const catalog = [{ id: "559741388", counterId: "109204270" }, { id: "559241229", counterId: null }];
    expect(goalCounterVerified(catalog, "559741388", "109204270")).toBe(true);
    expect(goalCounterVerified(catalog, "559241229", "109204270")).toBe(false);
    expect(goalCounterVerified(catalog, "559741388", "other")).toBe(false);
  });

  it("requires an explicit campaign list for VK and Telegram directions", () => {
    const campaigns = [
      { id: "prin", name: "ПРИН — геодезия", ad_account_id: "shared", metrika_counter_ids: [] },
      { id: "soda", name: "СОДА — геодезия", ad_account_id: "shared", metrika_counter_ids: [] },
      { id: "foreign", name: "ПРИН — чужой кабинет", ad_account_id: "other", metrika_counter_ids: [] },
    ];
    const base = { counter_id: null, ad_account_id: "shared", include_counterless_campaigns: false };
    expect([...directionCampaignIds(base, campaigns)]).toEqual([]);
    expect([...directionCampaignIds({ ...base, campaign_ids: ["prin", "foreign"] }, campaigns)]).toEqual(["prin"]);
    expect([...directionCampaignIds({ ...base, campaign_name_prefix: "ПРИН —" }, campaigns)]).toEqual(["prin"]);
  });

  it("warns when a new project campaign is not in any status direction", () => {
    const campaigns = [
      { id: "known", name: "Прин_каталог товаров", ad_account_id: "vk", metrika_counter_ids: [] },
      { id: "new", name: "Прин_новая кампания", ad_account_id: "vk", metrika_counter_ids: [] },
      { id: "other", name: "Сода_подписки", ad_account_id: "vk", metrika_counter_ids: [] },
    ];
    const metrics = ["known", "new", "other"].map((campaign_id) => ({ campaign_id, date: "2026-10-25", spend: 1, impressions: 1, clicks: 0, spend_includes_vat: false }));
    expect(uncoveredWeeklyCampaigns([{ ad_account_id: "vk", prefix: "Прин" }], campaigns, metrics, new Set(["known"]))).toEqual(["Прин_новая кампания"]);
  });

  it("uses a truthful spend label for a non-VAT channel", () => {
    const report: WeeklyStatusReport = {
      projectName: "Прин", reportUrl: null, period: { from: "2026-10-19", to: "2026-10-25" }, errors: [],
      directions: [{ name: "VK — подписки", spend: 100, spendLabel: "Расход без НДС", impressions: 1000, clicks: 10, ctr: 1,
        contactCpa: null, goals: [{ label: "Подписки", metricKind: "subscription", count: 2, cpa: 50, dates: [], value: null, valueLabel: null, includeInContactCpa: false }] }],
    };
    const text = formatWeeklyStatusMessage(report);
    expect(text).toContain("Расход без НДС: 100 ₽");
    expect(text).toContain("Подписки: 2 / CPA 50 ₽");
    expect(text).not.toContain("Расход с НДС");
  });

  it("marks an incomplete owner draft without inventing zero conversions", () => {
    const report: WeeklyStatusReport = {
      projectName: "СОДА", reportUrl: null, period: { from: "2026-10-19", to: "2026-10-25" },
      errors: ["Telegram Ads: нет нормализованных метрик за период."],
      directions: [{ name: "Telegram Ads", spend: null, spendLabel: "Расход в ₽ (пересчёт TON)", impressions: null,
        clicks: null, ctr: null, contactCpa: null, goals: [{ label: "Вступления", metricKind: "join", count: null,
          cpa: null, dates: [], value: null, valueLabel: null, includeInContactCpa: false }] }],
    };
    const text = formatWeeklyOwnerPreview(report);
    expect(text).toContain("Вступления: нет данных");
    expect(text).toContain("Черновик: данные нужно проверить");
    expect(text).not.toContain("Вступления: 0");
  });
});
