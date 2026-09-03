export type TelegramTaskMessageInput = {
  projectName: string | null;
  dueDate: string;
  workstream: string | null;
  title: string;
  description: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function displayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return year && month && day ? `${day}.${month}.${year}` : isoDate;
}

/** A deliberately short owner-approved task card for Telegram. */
export function formatTelegramTaskMessage(input: TelegramTaskMessageInput): string {
  const lines = [
    escapeHtml(input.projectName?.trim() || "Без проекта"),
    `<b>Дедлайн: ${escapeHtml(displayDate(input.dueDate))}</b>`,
    escapeHtml(input.workstream?.trim() || "Общее"),
    escapeHtml(input.description?.trim() || input.title.trim()),
  ];

  return lines.join("\n");
}

export function nextMoscowDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  // Keep this as a calendar calculation. Constructing a Moscow midnight and
  // incrementing its UTC day would be one day short because Moscow is UTC+3.
  const calendarDate = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))));
  calendarDate.setUTCDate(calendarDate.getUTCDate() + 1);
  return calendarDate.toISOString().slice(0, 10);
}
