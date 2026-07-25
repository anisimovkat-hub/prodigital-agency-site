import Link from "next/link";

import { PriorityBadge } from "@/components/badges";
import { FilterSelect } from "@/components/filter-select";
import { PersonalCalendarSchedule } from "@/components/personal-calendar";
import { ProjectBadge } from "@/components/project-badge";
import { dateISOInTimeZone } from "@/lib/calendar-events";
import { formatDate, formatDuration, todayISO } from "@/lib/format";
import { getPersonalCalendarEvents } from "@/lib/google-calendar";
import type { Enums } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/server";
import { filterTasksByAudience } from "@/lib/task-audience-filter";
import { sortTodayTasks } from "@/lib/today-sort";
import { cn } from "@/lib/utils";

type WeekSearch = { who?: string; assignee?: string };

type WeekTask = {
  id: string;
  title: string;
  priority: Enums<"task_priority"> | null;
  due_date: string | null;
  estimate_minutes: number | null;
  is_important: boolean | null;
  project_id: string | null;
  assignee_id: string | null;
  project: { id: string; name: string } | null;
  assignee: { id: string; full_name: string } | null;
};

type WeekDay = {
  date: Date;
  dateISO: string;
};

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<WeekSearch>;
}) {
  const { who, assignee } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? "";

  const [{ data }, { data: profiles }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id,title,priority,due_date,estimate_minutes,is_important,project_id,assignee_id,project:projects(id,name),assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
      )
      .neq("status", "done")
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("id,full_name,role").order("full_name"),
  ]);

  const currentProfile = (profiles ?? []).find((profile) => profile.id === uid);
  const showPersonalCalendar =
    currentProfile?.role === "owner" && !assignee && who !== "team";
  const today = showPersonalCalendar
    ? dateISOInTimeZone(new Date())
    : todayISO();
  const weekDays = getCurrentWeek(today);
  const weekStart = weekDays[0].dateISO;
  const weekEnd = weekDays.at(-1)!.dateISO;
  const calendar = showPersonalCalendar
    ? await getPersonalCalendarEvents(weekStart, weekEnd)
    : null;

  const tasks = filterTasksByAudience((data ?? []) as WeekTask[], {
    userId: uid,
    who,
    assigneeId: assignee,
  });
  const overdueTasks = sortTodayTasks(
    tasks.filter((task) => task.due_date && task.due_date < today),
    today,
  );
  const undatedTasks = sortTodayTasks(
    tasks.filter((task) => !task.due_date),
    today,
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Неделя</h1>
        <p className="text-sm text-neutral-500">
          Задачи и личное расписание на текущую неделю, с{" "}
          {formatShortDate(weekStart)} по {formatShortDate(weekEnd)}.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-1 border-b border-neutral-200">
          {[
            { key: "all", label: "Все", href: "/week" },
            { key: "mine", label: "Мои", href: "/week?who=mine" },
            { key: "personal", label: "Личные", href: "/week?who=personal" },
            { key: "team", label: "Команда", href: "/week?who=team" },
          ].map((tab) => {
            const activeKey = assignee ? "assignee" : who ?? "all";
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  activeKey === tab.key
                    ? "border-neutral-900 text-neutral-900"
                    : "border-transparent text-neutral-500 hover:text-neutral-800",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <FilterSelect
          name="assignee"
          label="Сотрудник"
          options={(profiles ?? []).map((profile) => ({
            value: profile.id,
            label: profile.full_name,
          }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TaskGroup title="Просрочено" tasks={overdueTasks} />
        <TaskGroup title="Без даты" tasks={undatedTasks} />
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[112rem] grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const dayTasks = sortTodayTasks(
              tasks.filter(
                (task) =>
                  task.due_date === day.dateISO && task.due_date >= today,
              ),
              today,
            );
            const totalEstimate = sumEstimate(dayTasks);
            const dayEvents =
              calendar?.events.filter((event) => event.date === day.dateISO) ??
              [];

            return (
              <section
                key={day.dateISO}
                className="flex min-h-52 flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2"
              >
                <h2 className="px-1 pt-1 text-sm font-semibold text-neutral-700">
                  {formatDayHeading(day.date)} · Σ{" "}
                  {formatDuration(totalEstimate)}
                </h2>
                {dayEvents.length > 0 && (
                  <PersonalCalendarSchedule
                    events={dayEvents}
                    timeZone={calendar?.timeZone ?? "Asia/Bangkok"}
                    compact
                    showHeading={false}
                  />
                )}
                {dayTasks.map((task) => (
                  <WeekTaskCard key={task.id} task={task} />
                ))}
                {dayTasks.length === 0 && dayEvents.length === 0 && (
                  <p className="px-1 py-3 text-xs text-neutral-400">Свободно</p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TaskGroup({ title, tasks }: { title: string; tasks: WeekTask[] }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
        <span className="text-xs text-neutral-400">{tasks.length}</span>
      </div>
      {tasks.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {tasks.map((task) => (
            <WeekTaskCard key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-400">Свободно</p>
      )}
    </section>
  );
}

function WeekTaskCard({ task }: { task: WeekTask }) {
  return (
    <article className="rounded-md border border-neutral-200 bg-white p-3 shadow-sm">
      <Link
        href={`/tasks?task=${task.id}`}
        className="text-sm font-medium text-neutral-900 hover:underline"
      >
        {task.title}
      </Link>
      <div className="mt-2">
        <PriorityBadge priority={task.priority ?? "medium"} />
      </div>
      <dl className="mt-2 grid gap-1 text-xs text-neutral-500">
        <div className="flex justify-between gap-2">
          <dt>Проект</dt>
          <dd className="min-w-0 text-right">
            <ProjectBadge
              projectId={task.project?.id}
              name={task.project?.name}
              className="max-w-36"
            />
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Дедлайн</dt>
          <dd className="text-right text-neutral-700">
            {formatDate(task.due_date)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Исполнитель</dt>
          <dd className="truncate text-right text-neutral-700">
            {task.assignee?.full_name ?? "Не назначен"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Оценка</dt>
          <dd className="text-right text-neutral-700">
            {formatDuration(task.estimate_minutes)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function getCurrentWeek(today: string): WeekDay[] {
  const currentDate = new Date(`${today}T00:00:00Z`);
  const daysSinceMonday = (currentDate.getUTCDay() + 6) % 7;
  const monday = new Date(currentDate);
  monday.setUTCDate(currentDate.getUTCDate() - daysSinceMonday);

  return Array.from({ length: 7 }, (_, index) => {
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
