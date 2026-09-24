export const MANIFEST_SPREADSHEET_ID = "1ACaiwXItdSdSQLimgQvaE59Ivac9Bz10G-ceKN2XrVs";
export const MANIFEST_PROJECT_ID = "9cda71ea-2511-4981-ad98-59deb1067435";

export type SheetMetric = {
  platform: "vk" | "telegram_ads";
  accountExternalId: string;
  accountName: string;
  campaignExternalId: string;
  campaignName: string;
  direction: "ПРИН" | "СОДА";
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  goal: string | null;
  results: number | null;
};

export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else cell += character;
  }
  if (quoted) throw new Error("Незакрытая кавычка в CSV Google Sheets");
  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function number(value: string): number {
  const parsed = Number(value.replace(/[\s\u00a0\u202f₽р.]/g, "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Некорректное число в таблице: ${value}`);
  return parsed;
}

function date(value: string): string {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) throw new Error(`Некорректная дата в таблице: ${value}`);
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  if (new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso) {
    throw new Error(`Некорректная дата в таблице: ${value}`);
  }
  return iso;
}

function verifyHeader(actual: string[], expected: string[], sheet: string): void {
  if (expected.some((value, index) => actual[index]?.trim() !== value)) {
    throw new Error(`Столбцы вкладки «${sheet}» изменились; импорт остановлен`);
  }
}

export function parseVkDays(rows: string[][]): SheetMetric[] {
  verifyHeader(rows[0] ?? [], ["Дата", "ID кабинета", "Кабинет", "ID кампании", "Кампания", "Расход без НДС, RUB", "Показы", "Клики", "Результат", "Цель кампании"], "VK Ads — дни");
  return rows.slice(1).filter((row) => row[0] && row[3]).map((row) => {
    const name = row[4]?.trim();
    if (!name) throw new Error("В строке VK нет названия кампании");
    const direction = /^СОДА\b/i.test(name) ? "СОДА" : "ПРИН";
    const goal = row[9]?.trim();
    return {
      platform: "vk", accountExternalId: row[1].trim(), accountName: row[2].trim(),
      campaignExternalId: row[3].trim(), campaignName: `${direction} · ${name}`,
      direction, date: date(row[0]), spend: number(row[5]),
      impressions: number(row[6]), clicks: number(row[7]),
      goal: goal && goal !== "—" ? `vk:${goal}` : null,
      results: row[8]?.trim() ? number(row[8]) : null,
    };
  });
}

export function parseTelegramDistribution(rows: string[][], tonRubRate: number): SheetMetric[] {
  if (!Number.isFinite(tonRubRate) || tonRubRate <= 0) throw new Error("Некорректный курс TON/RUB в таблице");
  const headerIndex = rows.findIndex((row) => row[0] === "Дата" && row[1] === "Проект" && row[10] === "Расход, RUB");
  if (headerIndex < 0) throw new Error("Не найдена дневная статистика на вкладке «Распределение проектов»");
  return rows.slice(headerIndex + 1).filter((row) => row[0] && (row[1] === "ПРИН" || row[1] === "СОДА")).map((row) => {
    const direction = row[1] as "ПРИН" | "СОДА";
    return {
      platform: "telegram_ads", accountExternalId: "manifest-telegram", accountName: "Манифест · Telegram Ads",
      campaignExternalId: `direction:${direction}`, campaignName: `${direction} · Telegram Ads`,
      direction, date: date(row[0]), spend: number(row[2]) * tonRubRate,
      impressions: number(row[3]), clicks: number(row[4]),
      goal: "telegram:joins", results: number(row[8] || "0"),
    };
  });
}

export async function fetchTonRubRate(): Promise<number> {
  const url = `https://docs.google.com/spreadsheets/d/${MANIFEST_SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=918273645&range=A2:B2`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Не удалось прочитать курс TON/RUB: ${response.status}`);
  const body = await response.text();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Google Sheets не вернул курс TON/RUB");
  const payload = JSON.parse(body.slice(start, end + 1)) as {
    status?: string;
    table?: { rows?: { c?: ({ v?: string | number } | null)[] }[] };
  };
  const label = payload.table?.rows?.[0]?.c?.[0]?.v;
  const rate = payload.table?.rows?.[0]?.c?.[1]?.v;
  if (payload.status !== "ok" || label !== "TON/RUB" || typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Google Sheets не вернул действительный курс TON/RUB");
  }
  return rate;
}

export async function fetchManifestSheet(gid: number): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${MANIFEST_SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
  const response = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error(`Google Sheets вернул ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/csv") && !contentType.includes("application/octet-stream")) {
    throw new Error("Google Sheets не отдал CSV. Проверьте доступ к таблице по ссылке");
  }
  return parseCsv(await response.text());
}
