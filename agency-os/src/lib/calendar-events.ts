import ical, {
  type CalendarResponse,
  type EventInstance,
  type ParameterValue,
  type VEvent,
} from "node-ical";

export const PERSONAL_CALENDAR_TIME_ZONE = "Asia/Bangkok";

export type CalendarEventCategory =
  | "meal"
  | "sport"
  | "call"
  | "meeting"
  | "travel"
  | "health"
  | "personal";

export type PersonalCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  date: string;
  allDay: boolean;
  category: CalendarEventCategory;
  location: string | null;
  meetingUrl: string | null;
};

export type ParsedCalendarEvents = {
  events: PersonalCalendarEvent[];
  timeZone: string;
};

export function parseCalendarEvents(
  source: string,
  fromDate: string,
  toDate: string,
): ParsedCalendarEvents {
  const calendar = ical.sync.parseICS(source);
  const timeZone =
    calendar.vcalendar?.["WR-TIMEZONE"] ?? PERSONAL_CALENDAR_TIME_ZONE;
  const expansionFrom = shiftISODate(fromDate, -1);
  const expansionTo = shiftISODate(toDate, 1);
  const instances = collectInstances(calendar, expansionFrom, expansionTo);
  const events = instances
    .map(({ event, instance }) =>
      toPersonalCalendarEvent(event, instance, timeZone),
    )
    .filter(
      (event): event is PersonalCalendarEvent =>
        event !== null &&
        event.category !== "meal" &&
        event.date >= fromDate &&
        event.date <= toDate,
    )
    .sort(compareCalendarEvents);

  return { events: deduplicateEvents(events), timeZone };
}

export function dateISOInTimeZone(
  value: Date,
  timeZone: string = PERSONAL_CALENDAR_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function classifyCalendarEvent(title: string): CalendarEventCategory {
  const normalized = title.toLocaleLowerCase("ru-RU");

  if (
    containsAny(normalized, [
      "бизнес-завтрак",
      "встреч",
      "мероприят",
      "конференц",
      "нетворкинг",
      "оффлайн",
      "офлайн",
    ])
  ) {
    return "meeting";
  }
  if (
    containsAny(normalized, [
      "перелет",
      "перелёт",
      "рейс",
      "аэропорт",
      "поезд",
      "поездк",
      "переезд",
      "дорог",
      "такси",
      "трансфер",
    ])
  ) {
    return "travel";
  }
  if (
    containsAny(normalized, [
      "врач",
      "доктор",
      "клиник",
      "стоматолог",
      "анализ",
      "медицин",
    ])
  ) {
    return "health";
  }
  if (
    containsAny(normalized, [
      "спорт",
      "трениров",
      "пилатес",
      "йога",
      "фитнес",
      "бег",
      "теннис",
      "силовая",
    ])
  ) {
    return "sport";
  }
  if (
    containsAny(normalized, [
      "созвон",
      "звонок",
      "zoom",
      "google meet",
      "teams",
    ])
  ) {
    return "call";
  }
  if (
    containsAny(normalized, [
      "завтрак",
      "обед",
      "ужин",
      "питание",
      "перекус",
      "ланч",
      "бранч",
      "полдник",
      "breakfast",
      "lunch",
      "dinner",
      "supper",
    ])
  ) {
    return "meal";
  }

  return "personal";
}

function collectInstances(
  calendar: CalendarResponse,
  fromDate: string,
  toDate: string,
): { event: VEvent; instance: EventInstance }[] {
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T23:59:59.999Z`);
  const collected: { event: VEvent; instance: EventInstance }[] = [];

  for (const component of Object.values(calendar)) {
    if (
      !component ||
      component.type !== "VEVENT" ||
      component.status === "CANCELLED" ||
      component.recurrenceid
    ) {
      continue;
    }

    if (component.rrule) {
      for (const instance of ical.expandRecurringEvent(component, {
        from,
        to,
        includeOverrides: true,
        excludeExdates: true,
        expandOngoing: true,
      })) {
        if (instance.event.status !== "CANCELLED") {
          collected.push({ event: instance.event, instance });
        }
      }
      continue;
    }

    const end = component.end ?? component.start;
    if (component.start <= to && end >= from) {
      collected.push({
        event: component,
        instance: {
          start: component.start,
          end,
          summary: component.summary,
          isFullDay:
            component.datetype === "date" || component.start.dateOnly === true,
          isRecurring: false,
          isOverride: false,
          event: component,
        },
      });
    }
  }

  return collected;
}

function toPersonalCalendarEvent(
  event: VEvent,
  instance: EventInstance,
  calendarTimeZone: string,
): PersonalCalendarEvent | null {
  const title = parameterValue(instance.summary).trim();
  if (!title) return null;

  const eventTimeZone = instance.start.tz ?? calendarTimeZone;
  const start = new Date(instance.start);
  const end = new Date(instance.end);

  return {
    id: `${event.uid}:${start.toISOString()}`,
    title,
    start: start.toISOString(),
    end: end.toISOString(),
    date: dateISOInTimeZone(start, eventTimeZone),
    allDay: instance.isFullDay,
    category: classifyCalendarEvent(title),
    location: event.location ? parameterValue(event.location).trim() || null : null,
    meetingUrl: extractMeetingUrl(event),
  };
}

function parameterValue(value: ParameterValue): string {
  return typeof value === "string" ? value : value.val;
}

// Достаёт ссылку на встречу/созвон из места или описания события. Возвращает
// только сам URL (не всё приватное описание), предпочитая известные площадки.
function extractMeetingUrl(event: VEvent): string | null {
  const parts: string[] = [];
  if (event.location) parts.push(parameterValue(event.location));
  const description = (event as { description?: ParameterValue }).description;
  if (description) parts.push(parameterValue(description));

  const urls = parts.join(" ").match(/https?:\/\/[^\s<>"']+/g);
  if (!urls || urls.length === 0) return null;

  const cleaned = urls.map((url) => url.replace(/[.,);]+$/, ""));
  const preferred = cleaned.find((url) =>
    /(meet\.google|zoom\.us|teams\.microsoft|telemost\.yandex|whereby\.com|jit\.si|webinar|contactout|talk\.)/i.test(
      url,
    ),
  );
  return preferred ?? cleaned[0];
}

function compareCalendarEvents(
  left: PersonalCalendarEvent,
  right: PersonalCalendarEvent,
): number {
  if (left.date !== right.date) return left.date.localeCompare(right.date);
  if (left.allDay !== right.allDay) return left.allDay ? -1 : 1;
  return left.start.localeCompare(right.start);
}

function deduplicateEvents(
  events: PersonalCalendarEvent[],
): PersonalCalendarEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.id}:${event.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function containsAny(value: string, fragments: string[]): boolean {
  return fragments.some((fragment) => value.includes(fragment));
}

function shiftISODate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
