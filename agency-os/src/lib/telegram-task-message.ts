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
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatBody(value: string): string {
  // CRM descriptions are plain text. Supporting this familiar lightweight
  // convention lets a manager stress important parts and attach named links
  // without exposing arbitrary HTML.
  return escapeHtml(value)
    .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([\s\S]+?)\*\*/g, "<b>$1</b>");
}

function projectPrefix(projectName: string | null): string {
  const name = projectName?.trim();
  if (!name) return "Задача";
  // CRM projects sometimes contain an internal stage after `//`. Employees see
  // the client/project name first; the task title supplies the actionable part.
  return name.split(/\s*\/\/\s*/, 1)[0]?.trim() || name;
}

function shortDeadline(isoDate: string, title: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const weekdays = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
  const weekday = weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const time = title.match(/(?:^|\s)(до|к)\s*(\d{1,2}(?::\d{2})?)(?=$|[\s.,;:!?])/i);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")} (${weekday})${time ? ` ${time[1].toLowerCase()} ${time[2]}` : ""}`;
}

/**
 * Formats the message as a manager would write it in Telegram, rather than as
 * a CRM field card. The date is rendered as a compact deadline, while the
 * employee receives a clear heading and the full useful context.
 */
export function formatTelegramTaskMessage(input: TelegramTaskMessageInput): string {
  const title = input.title.trim() || "Задача";
  const body = input.description?.trim() || title;
  return [
    `<b>${escapeHtml(projectPrefix(input.projectName))} // ${escapeHtml(title)}</b>`,
    `<b>${shortDeadline(input.dueDate, title)}</b>`,
    formatBody(body),
  ].join("\n\n");
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
