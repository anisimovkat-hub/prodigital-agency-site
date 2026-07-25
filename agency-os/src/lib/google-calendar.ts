import "server-only";

import {
  parseCalendarEvents,
  PERSONAL_CALENDAR_TIME_ZONE,
  type ParsedCalendarEvents,
} from "@/lib/calendar-events";

const REVALIDATE_SECONDS = 300;

export type PersonalCalendarResult = ParsedCalendarEvents & {
  configured: boolean;
  error: boolean;
};

export async function getPersonalCalendarEvents(
  fromDate: string,
  toDate: string,
): Promise<PersonalCalendarResult> {
  const calendarUrl = process.env.GOOGLE_CALENDAR_ICAL_URL;

  if (!calendarUrl) {
    return {
      events: [],
      timeZone: PERSONAL_CALENDAR_TIME_ZONE,
      configured: false,
      error: false,
    };
  }

  try {
    const response = await fetch(calendarUrl, {
      headers: { Accept: "text/calendar" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      throw new Error(`Google Calendar returned ${response.status}`);
    }

    const parsed = parseCalendarEvents(
      await response.text(),
      fromDate,
      toDate,
    );
    return { ...parsed, configured: true, error: false };
  } catch (error) {
    console.error(
      "Не удалось загрузить личный Google Calendar:",
      error instanceof Error ? error.message : "неизвестная ошибка",
    );
    return {
      events: [],
      timeZone: PERSONAL_CALENDAR_TIME_ZONE,
      configured: true,
      error: true,
    };
  }
}
