import Link from "next/link";

import { PriorityBadge } from "@/components/badges";
import { FilterSelect } from "@/components/filter-select";
import { PersonalCalendarSchedule } from "@/components/personal-calendar";
import { ProjectBadge } from "@/components/project-badge";
import { TaskDoneCheckbox } from "@/components/task-done-checkbox";
import { TaskViewSwitcher } from "@/components/task-view-switcher";
import { dateISOInTimeZone } from "@/lib/calendar-events";
import { formatDuration } from "@/lib/format";
import { getPersonalCalendarEvents } from "@/lib/google-calendar";
import { isTaskOperational } from "@/lib/project-lifecycle";
import type { Enums } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/server";
import {
  filterProfilesByTaskAccess,
  filterTasksByAudience,
} from "@/lib/task-audience-filter";
import { sortTodayTasks } from "@/lib/today-sort";
import { cn } from "@/lib/utils";

type WeekSearch = {
  who?: string;
  assignee?: string;
  start?: string;
};

type WeekTask = {
  id: string;
  title: string;
  priority: Enums<"task_priority"> | null;
  due_date: string | null;
  estimate_minutes: number | null;
  is_important: boolean | null;
  project_id: string | null;
  assignee_id: string | null;
  project: {
    id: string;
    name: string;
    stage: Enums<"project_stage"> | null;
  } | null;
  assignee: { id: string; full_name: string } | null;
};

type WeekDay = { date: Date; dateISO: string };
type CalendarData = Awaited<ReturnType<typeof getPersonalCalendarEvents>>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<WeekSearch>;
}) {
  const filters = await searchParams;
  const { who, assignee } = filters;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? "";

  const [{ data }, { data: profiles }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id,title,priority,due_date,estimate_minutes,is_important,project_id,assignee_id,project:projects(id,name,stage),assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
      )
      .neq("status", "done")
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("id,full_name,role,is_active")
      .order("full_name"),
  ]);

  const currentProfile = (profiles ?? []).find((profile) => profile.id === uid);
  const showPersonalCalendar =
    currentProfile?.role === "owner" && !assignee && who !== "team";
  const today = dateISOInTimeZone(new Date());
  const anchor = filters.start && ISO_DATE.test(filters.start)
    ? filters.start
    : today;
  const days = getTwoWeekDays(anchor);
  const weekStart = days[0].dateISO;
  const weekEnd = days.at(-1)!.dateISO;
  const calendar = showPersonalCalendar
    ? await getPersonalCalendarEvents(weekStart, weekEnd)
    : null;

  const tasks = filterTasksByAudience(
    ((data ?? []) as WeekTask[]).filter(isTaskOperational),
    { userId: uid, who, assigneeId: assignee },
  );
  const operationalTasks = ((data ?? []) as WeekTask[]).filter(isTaskOperational);
  const audienceProfiles = filterProfilesByTaskAccess(
    (profiles ?? []).filter((profile) => profile.is_active !== false),
    operationalTasks,
    {
      userId: uid,
      canViewAll: currentProfile?.role === "owner",
    },
  );
  const overdueTasks = sortTodayTasks(
    tasks.filter((task) => task.due_date && task.due_date < today),
    today,
  );
  const undatedTasks = sortTodayTasks(
    tasks.filter((task) => !task.due_date),
    today,
  );
  const activeKey = assignee ? "assignee" : who ?? "all";
  const includesToday = weekStart <= today && today <= weekEnd;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Задачи</h1>
          <p className="text-sm text-neutral-500">
            Недели: компактное расписание с {formatShortDate(weekStart)} по{" "}
            {formatShortDate(weekEnd)}.
          </p>
        </div>
        <TaskViewSwitcher />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-1 border-b border-neutral-200">
          {[
            { key: "all", label: "Все", who: undefined },
            { key: "mine", label: "Мои", who: "mine" },
            { key: "personal", label: "Личные", who: "personal" },
            { key: "team", label: "Команда", who: "team" },
          ].map((tab) => (
            <Link
              key={tab.key}
              href={buildWeekHref(filters, {
                who: tab.who,
                assignee: undefined,
              })}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                activeKey === tab.key
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-800",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <FilterSelect
          name="assignee"
          label="Сотрудник"
          options={audienceProfiles.map((profile) => ({
            value: profile.id,
            label: profile.full_name,
          }))}
        />
      </div>

      {(undatedTasks.length > 0 || overdueTasks.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          <TaskGroup title="Без даты" tasks={undatedTasks} />
          <TaskGroup title="Просрочено" tasks={overdueTasks} accent />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Link
            href={buildWeekHref(filters, {
              start: shiftDate(weekStart, -14),
            })}
            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            ← Предыдущие 2 недели
          </Link>
          {!includesToday && (
            <Link
              href={buildWeekHref(filters, { start: undefined })}
              className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              К текущей неделе
            </Link>
          )}
        </div>
        <Link
          href={buildWeekHref(filters, { start: shiftDate(weekStart, 14) })}
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Следующие 2 недели →
        </Link>
      </div>

      {[days.slice(0, 7), days.slice(7, 14)].map((weekDays, index) => (
        <WeekGrid
          key={weekDays[0].dateISO}
          title={
            includesToday
              ? index === 0
                ? "Текущая неделя"
                : "Следующая неделя"
              : `${formatShortDate(weekDays[0].dateISO)}–${formatShortDate(weekDays.at(-1)!.dateISO)}`
          }
          days={weekDays}
          tasks={tasks}
          calendar={calendar}
          today={today}
        />
      ))}
    </div>
  );
}

function WeekGrid({
  title,
  days,
  tasks,
  calendar,
  today,
}: {
  title: string;
  days: WeekDay[];
  tasks: WeekTask[];
  calendar: CalendarData | null;
  today: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[70rem] grid-cols-7 gap-2">
          {days.map((day) => {
            const dayTasks = sortTodayTasks(
              tasks.filter((task) => task.due_date === day.dateISO),
              today,
            );
            const dayEvents =
              calendar?.events.filter((event) => event.date === day.dateISO) ?? [];
            const hasItems = dayTasks.length > 0 || dayEvents.length > 0;

            return (
              <details
                key={day.dateISO}
                open={dayTasks.length <= 4 || dayEvents.length > 0}
                className={cn(
                  "group min-h-28 rounded-lg border bg-neutral-50 p-2",
                  day.dateISO === today
                    ? "border-blue-300 ring-1 ring-blue-100"
                    : "border-neutral-200",
                )}
              >
                <summary className="cursor-pointer list-none rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
                  <span className="block text-sm font-semibold text-neutral-800">
                    {formatDayHeading(day.date)}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-neutral-500">
                    {hasItems
                      ? `${dayTasks.length} задач · Σ ${formatDuration(sumEstimate(dayTasks))}`
                      : "Свободно"}
                  </span>
                </summary>
                <div className="mt-2 flex flex-col gap-1.5">
                  {dayEvents.length > 0 && (
                    <PersonalCalendarSchedule
                      events={dayEvents}
                      timeZone={calendar?.timeZone ?? "Europe/Moscow"}
                      compact
                      showHeading={false}
                    />
                  )}
                  {dayTasks.map((task) => (
                    <WeekTaskRow key={task.id} task={task} />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TaskGroup({
  title,
  tasks,
  accent = false,
}: {
  title: string;
  tasks: WeekTask[];
  accent?: boolean;
}) {
  if (tasks.length === 0) return null;
  return (
    <details
      open={tasks.length <= 5}
      className={cn(
        "rounded-lg border p-3",
        accent
          ? "border-red-200 bg-red-50"
          : "border-neutral-200 bg-neutral-50",
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
        <h2 className={cn("text-sm font-semibold", accent && "text-red-700")}>
          {title}
        </h2>
        <span className="text-xs text-neutral-500">{tasks.length}</span>
      </summary>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {tasks.map((task) => (
          <WeekTaskRow key={task.id} task={task} accent={accent} />
        ))}
      </div>
    </details>
  );
}

function WeekTaskRow({
  task,
  accent = false,
}: {
  task: WeekTask;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md border bg-white pr-2",
        accent ? "border-red-100" : "border-neutral-200",
      )}
    >
      <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md focus-within:ring-2 focus-within:ring-neutral-400">
        <TaskDoneCheckbox taskId={task.id} done={false} />
      </label>
      <div className="min-w-0 flex-1 py-1.5">
        <Link
          href={`/tasks?task=${task.id}`}
          className="block truncate text-sm font-medium text-neutral-900 hover:underline"
        >
          {task.title}
        </Link>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <PriorityBadge priority={task.priority ?? "medium"} />
          <ProjectBadge
            projectId={task.project?.id}
            name={task.project?.name}
            className="max-w-28"
          />
        </div>
      </div>
      <div className="hidden max-w-24 shrink-0 text-right text-[11px] text-neutral-500 xl:block">
        <span className="block truncate">
          {task.assignee?.full_name?.split(" ")[0] ?? "Не назначен"}
        </span>
        <span className="block">{formatDuration(task.estimate_minutes)}</span>
      </div>
    </div>
  );
}

function getTwoWeekDays(anchor: string): WeekDay[] {
  const currentDate = new Date(`${anchor}T00:00:00Z`);
  const daysSinceMonday = (currentDate.getUTCDay() + 6) % 7;
  const monday = new Date(currentDate);
  monday.setUTCDate(currentDate.getUTCDate() - daysSinceMonday);
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return { date, dateISO: date.toISOString().slice(0, 10) };
  });
}

function formatDayHeading(date: Date): string {
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function sumEstimate(tasks: WeekTask[]): number {
  return tasks.reduce((sum, task) => sum + (task.estimate_minutes ?? 0), 0);
}

function shiftDate(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildWeekHref(
  current: WeekSearch,
  overrides: Partial<WeekSearch>,
): string {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (merged.who) params.set("who", merged.who);
  if (merged.assignee) params.set("assignee", merged.assignee);
  if (merged.start) params.set("start", merged.start);
  const query = params.toString();
  return `/week${query ? `?${query}` : ""}`;
}
