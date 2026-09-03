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

function formatBody(value: string): string {
  // CRM descriptions are plain text. Supporting this familiar lightweight
  // convention lets a manager stress the important parts without exposing HTML.
  return escapeHtml(value).replace(/\*\*([\s\S]+?)\*\*/g, "<b>$1</b>");
}

function projectPrefix(projectName: string | null): string {
  const name = projectName?.trim();
  if (!name) return "Задача";
  // CRM projects sometimes contain an internal stage after `//`. Employees see
  // the client/project name first; the task title supplies the actionable part.
  return name.split(/\s*\/\/\s*/, 1)[0]?.trim() || name;
}

/**
 * Formats the message as a manager would write it in Telegram, rather than as
 * a CRM field card. The task's date and workstream stay in CRM for scheduling,
 * while the employee receives a clear heading and the full useful context.
 */
export function formatTelegramTaskMessage(input: TelegramTaskMessageInput): string {
  const title = input.title.trim() || "Задача";
  const body = input.description?.trim() || title;
  return `<b>${escapeHtml(projectPrefix(input.projectName))} // ${escapeHtml(title)}</b>\n\n${formatBody(body)}`;
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
