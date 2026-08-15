import "server-only";

import {
  mergeCalendarEvents,
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
  const calendarUrls = [
    process.env.GOOGLE_CALENDAR_ICAL_URL,
    process.env.GOOGLE_CALENDAR_SECONDARY_ICAL_URL,
  ].filter((url): url is string => Boolean(url));

  if (calendarUrls.length === 0) {
    return {
      events: [],
      timeZone: PERSONAL_CALENDAR_TIME_ZONE,
      configured: false,
      error: false,
    };
  }

  const results = await Promise.allSettled(
    calendarUrls.map((url) => loadCalendarSource(url)),
  );
  const calendarSources = results.flatMap((result, index) => {
    if (result.status === "fulfilled") return [result.value];
    console.error(
      `Не удалось загрузить личный Google Calendar ${index + 1}:`,
      result.reason instanceof Error
        ? result.reason.message
        : "неизвестная ошибка",
    );
    return [];
  });

  if (calendarSources.length === 0) {
    return {
      events: [],
      timeZone: PERSONAL_CALENDAR_TIME_ZONE,
      configured: true,
      error: true,
    };
  }

  const primaryCalendar = parseCalendarEvents(
    calendarSources[0],
    fromDate,
    toDate,
    PERSONAL_CALENDAR_TIME_ZONE,
  );
  const calendars = [
    primaryCalendar,
    ...calendarSources
      .slice(1)
      .map((source) =>
        parseCalendarEvents(
          source,
          fromDate,
          toDate,
          primaryCalendar.timeZone,
        ),
      ),
  ];

  return {
    ...mergeCalendarEvents(calendars),
    configured: true,
    error: calendars.length !== calendarUrls.length,
  };
}

async function loadCalendarSource(calendarUrl: string): Promise<string> {
  const response = await fetch(calendarUrl, {
    headers: { Accept: "text/calendar" },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!response.ok) {
    throw new Error(`Google Calendar returned ${response.status}`);
  }

  return response.text();
}
