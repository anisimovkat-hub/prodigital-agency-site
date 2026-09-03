import { describe, expect, it } from "vitest";

import { formatTelegramTaskMessage, nextMoscowDate } from "./telegram-task-message";

describe("formatTelegramTaskMessage", () => {
  it("formats an employee-ready message rather than a CRM field card", () => {
    expect(formatTelegramTaskMessage({
      projectName: "Капельницы // Первый шаг",
      dueDate: "2026-09-04",
      workstream: "Отчётность",
      title: "отчёт в понедельник до 12:00",
      description: "Нужно подготовить **отчёт** <в таблице>.\n\n[Открыть таблицу](https://docs.google.com/report?tab=1)",
    })).toBe("<b>Капельницы // отчёт в понедельник до 12:00</b>\n\n<b>04.09 (ПТ) до 12:00</b>\n\nНужно подготовить <b>отчёт</b> &lt;в таблице&gt;.\n\n<a href=\"https://docs.google.com/report?tab=1\">Открыть таблицу</a>");
  });

  it("uses the Moscow calendar date rather than UTC", () => {
    expect(nextMoscowDate(new Date("2026-09-03T21:30:00.000Z"))).toBe("2026-09-05");
  });
});
