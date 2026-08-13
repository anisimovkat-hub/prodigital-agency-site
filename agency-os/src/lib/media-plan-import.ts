export const MEDIA_PLAN_IMPORT_HEADERS = [
  "metric_key",
  "label",
  "target_value",
  "unit",
  "conversion_action_type",
  "campaign_external_id",
  "notes",
] as const;

export type MediaPlanMetricUnit = "money" | "count" | "percent";

export type MediaPlanImportRow = {
  metricKey: string;
  label: string;
  targetValue: number;
  unit: MediaPlanMetricUnit;
  conversionActionType: string | null;
  campaignExternalId: string | null;
  notes: string | null;
};

export type MediaPlanImportError = {
  row: number;
  field: string;
  message: string;
};

export type MediaPlanImportResult =
  | { success: true; rows: MediaPlanImportRow[] }
  | { success: false; errors: MediaPlanImportError[] };

const METRIC_UNITS: Record<string, MediaPlanMetricUnit> = {
  spend: "money",
  impressions: "count",
  clicks: "count",
  reach: "count",
  revenue: "money",
};

const GOOGLE_SHEETS_HOST = "docs.google.com";
const SPREADSHEET_ID_PATTERN = /^[a-zA-Z0-9_-]{20,}$/;

export function extractGoogleSpreadsheetId(value: string): string | null {
  const candidate = value.trim();
  if (SPREADSHEET_ID_PATTERN.test(candidate)) return candidate;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.hostname !== GOOGLE_SHEETS_HOST) {
    return null;
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const documentMarker = pathParts.lastIndexOf("d");
  const spreadsheetId = pathParts[documentMarker + 1];
  return spreadsheetId && SPREADSHEET_ID_PATTERN.test(spreadsheetId)
    ? spreadsheetId
    : null;
}

export function buildGoogleSheetsBatchGetUrl(
  spreadsheetId: string,
  ranges: string[],
): string | null {
  if (!SPREADSHEET_ID_PATTERN.test(spreadsheetId) || ranges.length === 0) {
    return null;
  }

  const normalizedRanges = ranges
    .map((range) => range.trim())
    .filter(Boolean)
    .slice(0, 20);
  if (normalizedRanges.length === 0) return null;

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet`,
  );
  for (const range of normalizedRanges) url.searchParams.append("ranges", range);
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");
  return url.toString();
}

export function parseMediaPlanImportRows(
  values: unknown[][],
): MediaPlanImportResult {
  if (values.length === 0) {
    return {
      success: false,
      errors: [{ row: 1, field: "headers", message: "Таблица пуста" }],
    };
  }

  const headerErrors = validateHeaders(values[0] ?? []);
  if (headerErrors.length > 0) {
    return { success: false, errors: headerErrors };
  }

  const rows: MediaPlanImportRow[] = [];
  const errors: MediaPlanImportError[] = [];
  const seenMetricScopes = new Set<string>();

  for (let index = 1; index < values.length; index += 1) {
    const source = values[index] ?? [];
    if (source.every((cell) => cellToString(cell) === "")) continue;

    const rowNumber = index + 1;
    const metricKey = cellToString(source[0]);
    const label = cellToString(source[1]);
    const targetValue = parseNonNegativeNumber(source[2]);
    const unit = cellToString(source[3]) as MediaPlanMetricUnit;
    const conversionActionType = nullableCell(source[4]);
    const campaignExternalId = nullableCell(source[5]);
    const notes = nullableCell(source[6]);
    const rowErrors: MediaPlanImportError[] = [];

    const expectedUnit = getExpectedUnit(metricKey);
    if (!expectedUnit) {
      rowErrors.push({
        row: rowNumber,
        field: "metric_key",
        message:
          "Допустимы spend, impressions, clicks, reach, revenue или conversion:<тип>",
      });
    }
    if (!label) {
      rowErrors.push({
        row: rowNumber,
        field: "label",
        message: "Добавьте понятное название метрики",
      });
    }
    if (targetValue === null) {
      rowErrors.push({
        row: rowNumber,
        field: "target_value",
        message: "Укажите неотрицательное число",
      });
    }
    if (!isMediaPlanMetricUnit(unit)) {
      rowErrors.push({
        row: rowNumber,
        field: "unit",
        message: "Допустимые единицы: money, count, percent",
      });
    } else if (expectedUnit && unit !== expectedUnit) {
      rowErrors.push({
        row: rowNumber,
        field: "unit",
        message: `Для ${metricKey} используйте ${expectedUnit}`,
      });
    }

    const conversionSuffix = metricKey.startsWith("conversion:")
      ? metricKey.slice("conversion:".length).trim()
      : null;
    if (conversionSuffix && conversionActionType !== conversionSuffix) {
      rowErrors.push({
        row: rowNumber,
        field: "conversion_action_type",
        message: `Укажите точный тип конверсии ${conversionSuffix}`,
      });
    } else if (!conversionSuffix && conversionActionType) {
      rowErrors.push({
        row: rowNumber,
        field: "conversion_action_type",
        message: "Тип конверсии заполняется только для conversion:<тип>",
      });
    }

    const metricScope = `${metricKey}\u0000${campaignExternalId ?? ""}`;
    if (metricKey && seenMetricScopes.has(metricScope)) {
      rowErrors.push({
        row: rowNumber,
        field: "metric_key",
        message: "Такая метрика для этой кампании уже есть в таблице",
      });
    }

    if (rowErrors.length > 0 || targetValue === null || !expectedUnit) {
      errors.push(...rowErrors);
      continue;
    }

    seenMetricScopes.add(metricScope);
    rows.push({
      metricKey,
      label,
      targetValue,
      unit,
      conversionActionType,
      campaignExternalId,
      notes,
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({
      row: 2,
      field: "rows",
      message: "Добавьте хотя бы одну строку с плановой метрикой",
    });
  }

  return errors.length > 0 ? { success: false, errors } : { success: true, rows };
}

function validateHeaders(headers: unknown[]): MediaPlanImportError[] {
  const actualHeaders = headers.map(cellToString);
  const errors: MediaPlanImportError[] = [];

  MEDIA_PLAN_IMPORT_HEADERS.forEach((expected, index) => {
    if (actualHeaders[index] !== expected) {
      errors.push({
        row: 1,
        field: expected,
        message: `Колонка ${index + 1} должна называться ${expected}`,
      });
    }
  });

  if (actualHeaders.slice(MEDIA_PLAN_IMPORT_HEADERS.length).some(Boolean)) {
    errors.push({
      row: 1,
      field: "headers",
      message: "Удалите неизвестные колонки после notes",
    });
  }

  return errors;
}

function getExpectedUnit(metricKey: string): MediaPlanMetricUnit | null {
  if (metricKey.startsWith("conversion:") && metricKey.length > 11) {
    return "count";
  }
  return METRIC_UNITS[metricKey] ?? null;
}

function isMediaPlanMetricUnit(value: string): value is MediaPlanMetricUnit {
  return value === "money" || value === "count" || value === "percent";
}

function cellToString(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function nullableCell(value: unknown): string | null {
  return cellToString(value) || null;
}

function parseNonNegativeNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
