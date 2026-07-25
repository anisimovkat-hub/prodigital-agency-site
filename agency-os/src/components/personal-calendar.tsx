import {
  CalendarDays,
  Dumbbell,
  ExternalLink,
  MapPin,
  PhoneCall,
  Plane,
  Stethoscope,
  Utensils,
  UsersRound,
} from "lucide-react";

import type {
  CalendarEventCategory,
  PersonalCalendarEvent,
} from "@/lib/calendar-events";
import { cn } from "@/lib/utils";

const CALENDAR_URL = "https://calendar.google.com/calendar/u/0/r";

const CATEGORY_STYLE: Record<
  CalendarEventCategory,
  { icon: typeof CalendarDays; card: string; iconClass: string; label: string }
> = {
  meal: {
    icon: Utensils,
    card: "border-orange-200 bg-orange-50/70",
    iconClass: "text-orange-600",
    label: "Питание",
  },
  sport: {
    icon: Dumbbell,
    card: "border-emerald-200 bg-emerald-50/70",
    iconClass: "text-emerald-600",
    label: "Спорт",
  },
  call: {
    icon: PhoneCall,
    card: "border-blue-200 bg-blue-50/70",
    iconClass: "text-blue-600",
    label: "Звонок",
  },
  meeting: {
    icon: UsersRound,
    card: "border-violet-200 bg-violet-50/70",
    iconClass: "text-violet-600",
    label: "Встреча",
  },
  travel: {
    icon: Plane,
    card: "border-sky-200 bg-sky-50/70",
    iconClass: "text-sky-600",
    label: "Поездка",
  },
  health: {
    icon: Stethoscope,
    card: "border-rose-200 bg-rose-50/70",
    iconClass: "text-rose-600",
    label: "Здоровье",
  },
  personal: {
    icon: CalendarDays,
    card: "border-neutral-200 bg-neutral-50",
    iconClass: "text-neutral-500",
    label: "Личное",
  },
};

export function PersonalCalendarSchedule({
  events,
  timeZone,
  title = "Расписание из Google Calendar",
  compact = false,
  showHeading = true,
  className,
}: {
  events: PersonalCalendarEvent[];
  timeZone: string;
  title?: string;
  compact?: boolean;
  showHeading?: boolean;
  className?: string;
}) {
  if (events.length === 0) return null;

  return (
    <section className={cn("flex flex-col gap-2", className)}>
      {showHeading && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-blue-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {events.length}
            </span>
          </div>
          <a
            href={CALENDAR_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            Открыть календарь
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>
      )}
      <div
        className={cn(
          compact ? "flex flex-col gap-1.5" : "grid gap-2 sm:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {events.map((event) => (
          <CalendarEventCard
            key={event.id}
            event={event}
            timeZone={timeZone}
            compact={compact}
          />
        ))}
      </div>
    </section>
  );
}

export function CalendarEventCard({
  event,
  timeZone,
  compact = false,
}: {
  event: PersonalCalendarEvent;
  timeZone: string;
  compact?: boolean;
}) {
  const style = CATEGORY_STYLE[event.category];
  const Icon = style.icon;

  return (
    <article
      className={cn(
        "rounded-md border",
        style.card,
        compact ? "p-2" : "p-3",
      )}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={cn("mt-0.5 size-4 shrink-0", style.iconClass)}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-medium text-neutral-900",
              compact ? "text-xs leading-4" : "text-sm",
            )}
          >
            {event.title}
          </p>
          <div
            className={cn(
              "mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-neutral-600",
              compact ? "text-[11px]" : "text-xs",
            )}
          >
            <span>{formatEventTime(event, timeZone)}</span>
            {!compact && <span>{style.label}</span>}
          </div>
          {event.location && (
            <p
              title={event.location}
              className={cn(
                "mt-1 flex items-center gap-1 truncate text-neutral-500",
                compact ? "text-[11px]" : "text-xs",
              )}
            >
              <MapPin className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{event.location}</span>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function formatEventTime(
  event: PersonalCalendarEvent,
  timeZone: string,
): string {
  if (event.allDay) return "Весь день";

  const formatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return `${formatter.format(new Date(event.start))}–${formatter.format(
    new Date(event.end),
  )}`;
}
