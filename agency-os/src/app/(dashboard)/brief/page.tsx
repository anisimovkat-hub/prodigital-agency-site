import { ArrowRight, CalendarClock, Lightbulb, UsersRound } from "lucide-react";
import Link from "next/link";

import { PriorityBadge } from "@/components/badges";
import { PersonalCalendarSchedule } from "@/components/personal-calendar";
import { ProjectBadge } from "@/components/project-badge";
import { Card, CardContent } from "@/components/ui/card";
import { dateISOInTimeZone } from "@/lib/calendar-events";
import {
  buildDailyBrief,
  type DailyBriefTask,
} from "@/lib/daily-brief";
import { formatDate } from "@/lib/format";
import { getPersonalCalendarEvents } from "@/lib/google-calendar";
import { isTaskOperational } from "@/lib/project-lifecycle";
import type { Enums } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type BriefTask = DailyBriefTask & {
  project: { id: string; name: string; stage: Enums<"project_stage"> | null } | null;
};

export default async function DailyBriefPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? "";
  const generatedAt = new Date();
  const today = dateISOInTimeZone(generatedAt);

  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id,title,assignee_id,project_id,status,due_date,priority,is_important,is_urgent,project:projects(id,name,stage)",
      )
      .neq("status", "done")
      .neq("status", "cancelled"),
    supabase
      .from("profiles")
      .select("id,full_name,role,is_active")
      .eq("is_active", true)
      .order("full_name"),
  ]);
  const currentProfile = (profiles ?? []).find((profile) => profile.id === uid);
  const isOwner = currentProfile?.role === "owner";
  const operationalTasks = ((tasks ?? []) as BriefTask[]).filter(
    isTaskOperational,
  );
  const brief = buildDailyBrief({
    tasks: operationalTasks,
    profiles: profiles ?? [],
    userId: uid,
    today,
    allowDelegation: isOwner,
  });
  const calendar = isOwner
    ? await getPersonalCalendarEvents(today, today)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            {formatLongDate(today)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
            Утренняя сводка
          </h1>
          <p className="text-sm text-neutral-500">
            План дня из актуальных задач и двух личных календарей. Ничего не изменяет в базе.
          </p>
        </div>
        <Link
          href="/today?who=mine"
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Открыть задачи дня
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="size-4 text-blue-600" aria-hidden />
            <h2 className="text-base font-semibold text-neutral-900">
              Встречи и события
            </h2>
          </div>
          {calendar?.events.length ? (
            <PersonalCalendarSchedule
              events={calendar.events}
              timeZone={calendar.timeZone}
              showHeading={false}
            />
          ) : (
            <EmptyText>Жёстко привязанных ко времени событий сегодня нет.</EmptyText>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <TaskSection
          title="Просрочено"
          subtitle="Сначала решить: сделать, перенести или делегировать"
          tasks={brief.overdue}
          today={today}
          tone="red"
        />
        <TaskSection
          title="На сегодня"
          subtitle="Задачи с дедлайном сегодня"
          tasks={brief.today}
          today={today}
          tone="amber"
        />
      </div>

      <TaskSection
        title="Срочное"
        subtitle="Важные задачи ближайших дней, которые нельзя потерять"
        tasks={brief.urgent}
        today={today}
        tone="amber"
      />

      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="size-4 text-blue-700" aria-hidden />
            <div>
              <h2 className="text-base font-semibold text-neutral-900">
                Три результата дня
              </h2>
              <p className="text-xs text-neutral-500">
                Сформированы по просрочке, дедлайну и срочности
              </p>
            </div>
          </div>
          {brief.focus.length ? (
            <ol className="grid gap-2 lg:grid-cols-3">
              {brief.focus.map((task, index) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks?task=${task.id}`}
                    className="flex h-full min-h-20 gap-3 rounded-lg border border-blue-200 bg-white p-3 transition hover:border-blue-300 hover:shadow-sm"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-neutral-900">
                        {task.title}
                      </span>
                      <span className="mt-1 block text-xs text-neutral-500">
                        {task.project?.name ?? "Личное"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyText>На сегодня нет открытых задач.</EmptyText>
          )}
        </CardContent>
      </Card>


      {isOwner && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <UsersRound className="size-4 text-violet-600" aria-hidden />
              <div>
                <h2 className="text-base font-semibold text-neutral-900">
                  Что можно делегировать
                </h2>
                <p className="text-xs text-neutral-500">
                  Подсказка, а не автоматическое переназначение
                </p>
              </div>
            </div>
            {brief.delegationSuggestions.length ? (
              <ul className="grid gap-2 lg:grid-cols-3">
                {brief.delegationSuggestions.map((suggestion) => (
                  <li
                    key={suggestion.task.id}
                    className="rounded-lg border border-violet-100 bg-violet-50/50 p-3"
                  >
                    <Link
                      href={`/tasks?task=${suggestion.task.id}`}
                      className="text-sm font-semibold text-neutral-900 hover:underline"
                    >
                      {suggestion.task.title}
                    </Link>
                    <p className="mt-1 text-xs text-neutral-600">
                      → {suggestion.suggestedProfile.full_name} · сейчас открыто {suggestion.currentOpenTasks}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyText>
                Явных кандидатов нет: задачи дня уже распределены или команда загружена.
              </EmptyText>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


function TaskSection({
  title,
  subtitle,
  tasks,
  today,
  tone,
}: {
  title: string;
  subtitle: string;
  tasks: BriefTask[];
  today: string;
  tone: "red" | "amber";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
            <p className="text-xs text-neutral-500">{subtitle}</p>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              tone === "red"
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-800",
            )}
          >
            {tasks.length}
          </span>
        </div>
        {tasks.length ? (
          <ul className="flex flex-col gap-1.5">
            {tasks.map((task) => (
              <BriefTaskRow key={task.id} task={task} today={today} />
            ))}
          </ul>
        ) : (
          <EmptyText>Задач в этом блоке нет.</EmptyText>
        )}
      </CardContent>
    </Card>
  );
}

function BriefTaskRow({ task, today }: { task: BriefTask; today: string }) {
  const overdue = !!task.due_date && task.due_date < today;
  return (
    <li className="flex min-h-12 items-center gap-3 rounded-md border border-neutral-100 bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <Link
          href={`/tasks?task=${task.id}`}
          className="block truncate text-sm font-medium text-neutral-900 hover:underline"
        >
          {task.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <ProjectBadge
            projectId={task.project?.id}
            name={task.project?.name ?? "Личное"}
            className="max-w-44"
          />
          <PriorityBadge priority={(task.priority ?? "medium") as Enums<"task_priority">} />
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 text-xs font-medium",
          overdue ? "text-red-600" : "text-neutral-500",
        )}
      >
        {formatDate(task.due_date)}
      </span>
    </li>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-neutral-50 px-3 py-3 text-sm text-neutral-500">
      {children}
    </p>
  );
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}
