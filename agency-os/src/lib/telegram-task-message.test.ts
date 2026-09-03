import { describe, expect, it } from "vitest";

import { formatTelegramTaskMessage, nextMoscowDate } from "./telegram-task-message";

describe("formatTelegramTaskMessage", () => {
  it("keeps the concise four-line task format and escapes CRM text", () => {
    expect(formatTelegramTaskMessage({
      projectName: "Капельницы // Первый шаг",
      dueDate: "2026-09-04",
      workstream: "Отчётность",
      title: "Отчёт",
      description: "Сделать <отчёт> до 12:00",
    })).toBe("Капельницы // Первый шаг\n<b>Дедлайн: 04.09.2026</b>\nОтчётность\nСделать &lt;отчёт&gt; до 12:00");
  });

  it("uses the Moscow calendar date rather than UTC", () => {
    expect(nextMoscowDate(new Date("2026-09-03T21:30:00.000Z"))).toBe("2026-09-05");
  });
});
