import { describe, expect, it } from "vitest";

import {
  buildGoogleSheetsBatchGetUrl,
  extractGoogleSpreadsheetId,
  MEDIA_PLAN_IMPORT_HEADERS,
  parseMediaPlanImportRows,
} from "@/lib/media-plan-import";

const spreadsheetId = "1AbCdEfGhIjKlMnOpQrStUvWxYz_123456789";

describe("extractGoogleSpreadsheetId", () => {
  it("извлекает id из обычной ссылки Google Sheets", () => {
    expect(
      extractGoogleSpreadsheetId(
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`,
      ),
    ).toBe(spreadsheetId);
  });

  it("поддерживает ссылку с профилем Google и прямой id", () => {
    expect(
      extractGoogleSpreadsheetId(
        `https://docs.google.com/spreadsheets/u/1/d/${spreadsheetId}/edit`,
      ),
    ).toBe(spreadsheetId);
    expect(extractGoogleSpreadsheetId(spreadsheetId)).toBe(spreadsheetId);
  });

  it("не принимает чужой домен и небезопасный протокол", () => {
    expect(
      extractGoogleSpreadsheetId(
        `https://example.com/spreadsheets/d/${spreadsheetId}/edit`,
      ),
    ).toBeNull();
    expect(
      extractGoogleSpreadsheetId(
        `http://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      ),
    ).toBeNull();
  });
});

describe("buildGoogleSheetsBatchGetUrl", () => {
  it("строит read-only запрос с неформатированными числовыми значениями", () => {
    const value = buildGoogleSheetsBatchGetUrl(spreadsheetId, [
      "Agency OS!A1:G50",
      "Итоги!A1:B5",
    ]);
    const url = new URL(value ?? "");

    expect(url.pathname).toBe(
      `/v4/spreadsheets/${spreadsheetId}/values:batchGet`,
    );
    expect(url.searchParams.getAll("ranges")).toEqual([
      "Agency OS!A1:G50",
      "Итоги!A1:B5",
    ]);
    expect(url.searchParams.get("valueRenderOption")).toBe(
      "UNFORMATTED_VALUE",
    );
  });

  it("отклоняет неверный id и пустые диапазоны", () => {
    expect(buildGoogleSheetsBatchGetUrl("bad", ["A1:G10"])).toBeNull();
    expect(buildGoogleSheetsBatchGetUrl(spreadsheetId, [" "])).toBeNull();
  });
});

describe("parseMediaPlanImportRows", () => {
  it("разбирает корректный медиаплан и пропускает пустые строки", () => {
    const result = parseMediaPlanImportRows([
      [...MEDIA_PLAN_IMPORT_HEADERS],
      ["spend", "Бюджет", "150 000", "money", "", "", "Август"],
      [],
      [
        "conversion:lead",
        "Заявки",
        250,
        "count",
        "lead",
        "campaign-42",
        "",
      ],
    ]);

    expect(result).toEqual({
      success: true,
      rows: [
        {
          metricKey: "spend",
          label: "Бюджет",
          targetValue: 150000,
          unit: "money",
          conversionActionType: null,
          campaignExternalId: null,
          notes: "Август",
        },
        {
          metricKey: "conversion:lead",
          label: "Заявки",
          targetValue: 250,
          unit: "count",
          conversionActionType: "lead",
          campaignExternalId: "campaign-42",
          notes: null,
        },
      ],
    });
  });

  it("отклоняет изменённые заголовки до разбора строк", () => {
    const result = parseMediaPlanImportRows([
      ["Метрика", ...MEDIA_PLAN_IMPORT_HEADERS.slice(1)],
      ["spend", "Бюджет", 10, "money"],
    ]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toMatchObject({ row: 1, field: "metric_key" });
    }
  });

  it("возвращает понятные ошибки для значения, единицы и конверсии", () => {
    const result = parseMediaPlanImportRows([
      [...MEDIA_PLAN_IMPORT_HEADERS],
      ["spend", "", -1, "count", "lead", "", ""],
      ["conversion:purchase", "Покупки", 4, "count", "lead", "", ""],
    ]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ row: 2, field: "label" }),
          expect.objectContaining({ row: 2, field: "target_value" }),
          expect.objectContaining({ row: 2, field: "unit" }),
          expect.objectContaining({
            row: 2,
            field: "conversion_action_type",
          }),
          expect.objectContaining({
            row: 3,
            field: "conversion_action_type",
          }),
        ]),
      );
    }
  });

  it("не допускает дубли одной метрики в рамках кампании", () => {
    const result = parseMediaPlanImportRows([
      [...MEDIA_PLAN_IMPORT_HEADERS],
      ["clicks", "Клики", 100, "count", "", "campaign-1", ""],
      ["clicks", "Клики ещё раз", 120, "count", "", "campaign-1", ""],
      ["clicks", "Клики другой кампании", 80, "count", "", "campaign-2", ""],
    ]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ row: 3, field: "metric_key" }),
      );
    }
  });
});
