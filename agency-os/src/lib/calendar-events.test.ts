import { describe, expect, it } from "vitest";

import {
  classifyCalendarEvent,
  dateISOInTimeZone,
  mergeCalendarEvents,
  parseCalendarEvents,
} from "@/lib/calendar-events";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Agency OS//Calendar tests//RU
X-WR-TIMEZONE:Asia/Bangkok
BEGIN:VEVENT
UID:meal
DTSTAMP:20260724T000000Z
DTSTART;TZID=Asia/Bangkok:20260727T090000
DTEND;TZID=Asia/Bangkok:20260727T093000
RRULE:FREQ=DAILY;COUNT=3
SUMMARY:Завтрак
END:VEVENT
BEGIN:VEVENT
UID:call
DTSTAMP:20260724T000000Z
DTSTART;TZID=Asia/Bangkok:20260728T140000
DTEND;TZID=Asia/Bangkok:20260728T150000
SUMMARY:Созвон с командой
LOCATION:Google Meet
DESCRIPTION:Подключайтесь по ссылке: https://meet.google.com/abc-defg-hij
END:VEVENT
BEGIN:VEVENT
UID:cancelled
DTSTAMP:20260724T000000Z
DTSTART;TZID=Asia/Bangkok:20260728T160000
DTEND;TZID=Asia/Bangkok:20260728T170000
SUMMARY:Отменённая встреча
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;

const SECOND_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Agency OS//Second calendar tests//RU
X-WR-TIMEZONE:Asia/Bangkok
BEGIN:VEVENT
UID:duplicate-call-from-second-account
DTSTAMP:20260724T000000Z
DTSTART;TZID=Asia/Bangkok:20260728T140000
DTEND;TZID=Asia/Bangkok:20260728T150000
SUMMARY:Созвон с командой
END:VEVENT
BEGIN:VEVENT
UID:flight
DTSTAMP:20260724T000000Z
DTSTART;TZID=Asia/Bangkok:20260729T100000
DTEND;TZID=Asia/Bangkok:20260729T120000
SUMMARY:Перелёт в Москву
END:VEVENT
END:VCALENDAR`;

describe("parseCalendarEvents", () => {
  it("сохраняет часовой пояс и исключает питание и отменённые события", () => {
    const result = parseCalendarEvents(ICS, "2026-07-27", "2026-08-02");

    expect(result.timeZone).toBe("Asia/Bangkok");
    expect(result.events).toHaveLength(1);
    expect(result.events.map((event) => event.date)).toEqual(["2026-07-28"]);
    expect(result.events.some((event) => event.category === "meal")).toBe(false);
    expect(result.events.find((event) => event.title.includes("Созвон"))).toMatchObject({
      category: "call",
      location: "Google Meet",
      meetingUrl: "https://meet.google.com/abc-defg-hij",
    });
  });
});

describe("mergeCalendarEvents", () => {
  it("объединяет два календаря и убирает одинаковое событие", () => {
    const first = parseCalendarEvents(ICS, "2026-07-27", "2026-08-02");
    const second = parseCalendarEvents(
      SECOND_ICS,
      "2026-07-27",
      "2026-08-02",
      first.timeZone,
    );
    const result = mergeCalendarEvents([first, second]);

    expect(result.events.map((event) => event.title)).toEqual([
      "Созвон с командой",
      "Перелёт в Москву",
    ]);
    expect(result.timeZone).toBe(first.timeZone);
    expect(second.timeZone).toBe(first.timeZone);
  });
});

describe("classifyCalendarEvent", () => {
  it.each([
    ["Бизнес-завтрак с партнёром", "meeting"],
    ["Перелёт в Москву", "travel"],
    ["Приём у врача", "health"],
    ["Пилатес", "sport"],
    ["Созвон CSS", "call"],
    ["Ужин", "meal"],
    ["Lunch", "meal"],
    ["Личное время", "personal"],
  ] as const)("определяет категорию «%s»", (title, category) => {
    expect(classifyCalendarEvent(title)).toBe(category);
  });
});

describe("dateISOInTimeZone", () => {
  it("учитывает границу суток в часовом поясе календаря", () => {
    expect(
      dateISOInTimeZone(new Date("2026-07-24T18:30:00.000Z"), "Asia/Bangkok"),
    ).toBe("2026-07-25");
  });
});
