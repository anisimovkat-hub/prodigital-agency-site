import Link from "next/link";

import { FilterSelect } from "@/components/filter-select";
import { HealthBadge } from "@/components/badges";
import { PersonalCalendarSchedule } from "@/components/personal-calendar";
import { TaskDoneCheckbox } from "@/components/task-done-checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectBadge } from "@/components/project-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateISOInTimeZone } from "@/lib/calendar-events";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  todayISO,
} from "@/lib/format";
import { getPersonalCalendarEvents } from "@/lib/google-calendar";
import { PROJECT_HEALTH_LABEL } from "@/lib/labels";
import { isTaskOperational } from "@/lib/project-lifecycle";
import { createClient } from "@/lib/supabase/server";
import { sortProjectsForDisplay } from "@/lib/project-order";
import { isActiveTaskStatus } from "@/lib/task-status";
import type { Enums } from "@/lib/supabase/types";
import { sortTodayTasks } from "@/lib/today-sort";
import { cn } from "@/lib/utils";

type DashTask = {
  id: string;
  title: string;
  status: Enums<"task_status"> | null;
  due_date: string | null;
  priority: Enums<"task_priority"> | null;
  is_important: boolean | null;
  is_urgent: boolean | null;
  assignee_id: string | null;
  creator_id: string | null;
  project_id: string | null;
  assignee: { id: string; full_name: string } | null;
  project: {
    id: string;
    name: string;
    stage: Enums<"project_stage"> | null;
  } | null;
};

function DayTaskRow({ task, today }: { task: DashTask; today: string }) {
  const overdue = !!task.due_date && task.due_date < today;
  return (
    <li
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-2 py-2",
        overdue && "bg-red-50/70",
      )}
    >
      <label className="-ml-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md focus-within:ring-2 focus-within:ring-neutral-400">
        <TaskDoneCheckbox taskId={task.id} done={false} />
      </label>
      <div className="min-w-0 flex-1">
        <Link
          href={`/tasks?task=${task.id}`}
          className="block truncate rounded-sm text-sm font-medium text-neutral-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          {task.title}
        </Link>
        <div className="mt-1 flex items-center gap-2 sm:hidden">
          <ProjectBadge
            projectId={task.project?.id}
            name={task.project?.name ?? "Личное"}
            className="max-w-40"
          />
        </div>
      </div>
      <ProjectBadge
        projectId={task.project?.id}
        name={task.project?.name ?? "Личное"}
        className="hidden max-w-40 shrink-0 sm:inline-flex"
      />
      <div className="w-24 shrink-0 text-right">
        <span
          className={cn(
            "block text-xs font-medium",
            overdue ? "text-red-700" : "text-neutral-500",
          )}
        >
          {overdue ? "Просрочено" : "Сегодня"}
        </span>
        <span
          className={cn(
            "block text-[11px]",
            overdue ? "text-red-600" : "text-neutral-400",
          )}
        >
          {formatDate(task.due_date)}
        </span>
      </div>
    </li>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ health?: string; client?: string }>;
}) {
  const { health, client } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? "";

  const [
    { data: projects },
    { data: clients },
    { data: tasks },
    { data: kpiEntries },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*, client:clients(id,name), responsible:profiles!projects_responsible_id_fkey(id,full_name)")
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id,name,status").order("name"),
    supabase
      .from("tasks")
      .select(
        "id,project_id,title,status,due_date,priority,is_important,is_urgent,assignee_id,creator_id, assignee:profiles!tasks_assignee_id_fkey(id,full_name), project:projects(id,name,stage)",
      ),
    supabase
      .from("kpi_entries")
      .select("*")
      .order("entry_date", { ascending: false }),
    supabase.from("profiles").select("id,full_name,role").order("full_name"),
  ]);

  const currentProfile = (profiles ?? []).find((profile) => profile.id === uid);
  const showPersonalCalendar = currentProfile?.role === "owner";
  const today = showPersonalCalendar
    ? dateISOInTimeZone(new Date())
    : todayISO();
  const calendar = showPersonalCalendar
    ? await getPersonalCalendarEvents(today, today)
    : null;
  const activeProjectsCount = (projects ?? []).filter(
    (project) =>
      project.stage === "active" || project.stage === "launching",
  ).length;
  const operationalTasks = ((tasks ?? []) as unknown as DashTask[]).filter(
    isTaskOperational,
  );
  const todayTasksCount = operationalTasks.filter(
    (task) => isActiveTaskStatus(task.status) && task.due_date === today,
  ).length;
  const overdueTasksCount = operationalTasks.filter(
    (task) =>
      isActiveTaskStatus(task.status) && task.due_date && task.due_date < today,
  ).length;
  const activeClientsCount = (clients ?? []).filter(
    (item) => item.status === "active",
  ).length;

  const summaries = [
    {
      label: "Активные проекты",
      value: activeProjectsCount,
      href: "/projects",
      accent: "border-t-blue-500",
      valueColor: "text-blue-700",
    },
    {
      label: "Задачи на сегодня",
      value: todayTasksCount,
      href: "/today",
      accent: "border-t-amber-500",
      valueColor: "text-amber-700",
    },
    {
      label: "Просрочено",
      value: overdueTasksCount,
      href: "/today",
      accent: "border-t-red-500",
      valueColor: "text-red-700",
    },
    {
      label: "Активные клиенты",
      value: activeClientsCount,
      href: "/clients",
      accent: "border-t-emerald-500",
      valueColor: "text-emerald-700",
    },
  ];

  const taskStatsByProject = new Map<
    string,
    { urgent: number; overdue: number; nearestDueDate: string | null }
  >();
  for (const task of operationalTasks) {
    if (!task.project_id) continue;
    const stats = taskStatsByProject.get(task.project_id) ?? {
      urgent: 0,
      overdue: 0,
      nearestDueDate: null,
    };
    const open = isActiveTaskStatus(task.status);
    if (open && task.is_urgent) stats.urgent += 1;
    if (open && task.due_date && task.due_date < today) stats.overdue += 1;
    if (
      open &&
      task.due_date &&
      (!stats.nearestDueDate || task.due_date < stats.nearestDueDate)
    ) {
      stats.nearestDueDate = task.due_date;
    }
    taskStatsByProject.set(task.project_id, stats);
  }

  const latestKpiByProject = new Map<
    string,
    NonNullable<typeof kpiEntries>[number]
  >();
  for (const entry of kpiEntries ?? []) {
    if (!entry.project_id) continue;
    if (!latestKpiByProject.has(entry.project_id)) {
      latestKpiByProject.set(entry.project_id, entry);
    }
  }

  const filteredProjects = sortProjectsForDisplay(
    (projects ?? []).filter((project) => {
      if (health && project.health !== health) return false;
      if (client && project.client_id !== client) return false;
      return true;
    }),
  );

  const healthOptions = (
    Object.keys(PROJECT_HEALTH_LABEL) as Enums<"project_health">[]
  ).map((value) => ({ value, label: PROJECT_HEALTH_LABEL[value] }));

  const clientOptions = (clients ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  // ── Мой день / загрузка команды / зависшие делегированные ──
  const allTasks = operationalTasks;
  const isOpen = (t: DashTask) => isActiveTaskStatus(t.status);
  const byDue = (a: DashTask, b: DashTask) =>
    (a.due_date ?? "9999") < (b.due_date ?? "9999") ? -1 : 1;

  const myToday = sortTodayTasks(
    allTasks.filter(
      (t) => isOpen(t) && t.assignee_id === uid && t.due_date === today,
    ),
    today,
  );

  const myOverdue = sortTodayTasks(
    allTasks.filter(
      (t) =>
        isOpen(t) && t.assignee_id === uid && !!t.due_date && t.due_date < today,
    ),
    today,
  );

  const staleDelegated = allTasks
    .filter(
      (t) =>
        isOpen(t) &&
        t.creator_id === uid &&
        !!t.assignee_id &&
        t.assignee_id !== uid &&
        !!t.due_date &&
        t.due_date < today,
    )
    .sort(byDue);

  const teamLoad = (profiles ?? [])
    .filter((p) => p.id !== uid)
    .map((p) => {
      const own = allTasks.filter((t) => t.assignee_id === p.id && isOpen(t));
      return {
        id: p.id,
        name: p.full_name,
        open: own.length,
        inProgress: own.filter((t) => t.status === "in_progress").length,
        todayCount: own.filter((t) => t.due_date === today).length,
        overdue: own.filter((t) => !!t.due_date && t.due_date < today).length,
      };
    })
    .sort((a, b) => a.open - b.open);

  // ── Требует внимания ──
  const unassigned = allTasks.filter(
    (t) => isOpen(t) && !!t.project_id && !t.assignee_id,
  );
  const projectsWithOpenTask = new Set<string>();
  for (const t of allTasks) {
    if (isOpen(t) && t.project_id) projectsWithOpenTask.add(t.project_id);
  }
  const activeProjects = (projects ?? []).filter(
    (project) =>
      project.stage === "active" || project.stage === "launching",
  );
  const redProjects = activeProjects.filter((p) => p.health === "red");
  const quietProjects = activeProjects.filter(
    (p) => !projectsWithOpenTask.has(p.id),
  );

  const attentionTones = {
    red: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    amber: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  } as const;
  const attention = [
    {
      key: "my-overdue",
      count: myOverdue.length,
      label: "Мои просроченные",
      href: "/today?who=mine",
      tone: "red" as const,
    },
    {
      key: "delegated-overdue",
      count: staleDelegated.length,
      label: "Делегированные просрочены",
      href: "/personal?view=delegated",
      tone: "red" as const,
    },
    {
      key: "red-projects",
      count: redProjects.length,
      label: "Проекты в красной зоне",
      href: "/?health=red",
      tone: "red" as const,
    },
    {
      key: "unassigned",
      count: unassigned.length,
      label: "Задачи без исполнителя",
      href: "/tasks",
      tone: "amber" as const,
    },
    {
      key: "quiet-projects",
      count: quietProjects.length,
      label: "Проекты без активных задач",
      href: "/projects",
      tone: "amber" as const,
    },
  ].filter((item) => item.count > 0);
  const hasCalendarEvents = !!calendar?.events.length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Дашборд</h1>
        <p className="text-sm text-neutral-500">
          Проекты агентства, статусы и ключевые показатели.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaries.map((summary) => (
          <Link
            key={summary.label}
            href={summary.href}
            className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2"
          >
            <Card
              className={`h-full cursor-pointer border-t-4 transition duration-150 group-hover:-translate-y-0.5 group-hover:shadow-md ${summary.accent}`}
            >
              <CardContent className="p-4">
                <p className="text-sm text-neutral-500">{summary.label}</p>
                <p
                  className={`mt-1 text-3xl font-semibold tracking-tight ${summary.valueColor}`}
                >
                  {summary.value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div
        className={cn(
          "grid gap-4",
          hasCalendarEvents && "lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]",
        )}
      >
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">
                  Задачи на сегодня
                </h2>
                <p className="text-xs text-neutral-500">
                  Сначала просроченные, затем задачи с дедлайном сегодня
                </p>
              </div>
              <span className="text-xs text-neutral-400">
                {myOverdue.length + myToday.length}
              </span>
            </div>
            {myOverdue.length > 0 && (
              <div className="mb-2">
                <ul className="flex flex-col gap-1">
                  {myOverdue.map((task) => (
                    <DayTaskRow key={task.id} task={task} today={today} />
                  ))}
                </ul>
              </div>
            )}
            {myToday.length === 0 ? (
              myOverdue.length === 0 && (
                <p className="rounded-md bg-neutral-50 px-3 py-3 text-sm text-neutral-500">
                  На сегодня задач нет.
                </p>
              )
            ) : (
              <ul className="flex flex-col gap-1">
                {myToday.map((task) => (
                  <DayTaskRow key={task.id} task={task} today={today} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {hasCalendarEvents && calendar && (
          <Card>
            <CardContent className="p-4">
              <PersonalCalendarSchedule
                events={calendar.events}
                timeZone={calendar.timeZone}
                title="Расписание"
                compact
              />
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-base font-semibold text-neutral-900">
            Требует внимания
          </h2>
          {attention.length === 0 ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              Всё под контролем
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {attention.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex min-h-14 items-center gap-3 rounded-md border px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 ${attentionTones[item.tone]}`}
                >
                  <span className="text-2xl font-semibold tabular-nums">
                    {item.count}
                  </span>
                  <span className="text-sm font-medium leading-tight">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {teamLoad.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">
              Загрузка команды
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>В работе</TableHead>
                  <TableHead>Открытых</TableHead>
                  <TableHead>Сегодня</TableHead>
                  <TableHead>Просрочено</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamLoad.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-neutral-900">
                      <Link
                        href={`/tasks?assignee=${row.id}`}
                        className="hover:underline"
                      >
                        {row.name}
                      </Link>
                      {row.open === 0 && (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          свободен
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{row.inProgress}</TableCell>
                    <TableCell>{row.open}</TableCell>
                    <TableCell>{row.todayCount}</TableCell>
                    <TableCell
                      className={
                        row.overdue > 0 ? "font-medium text-red-600" : ""
                      }
                    >
                      {row.overdue}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <FilterSelect name="health" label="Статус" options={healthOptions} />
        <FilterSelect name="client" label="Клиент" options={clientOptions} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Проект</TableHead>
            <TableHead>Клиент</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Ответственный</TableHead>
            <TableHead>Бюджет</TableHead>
            <TableHead>Расход</TableHead>
            <TableHead>Лиды</TableHead>
            <TableHead>CPL</TableHead>
            <TableHead>ДРР</TableHead>
            <TableHead>ROMI</TableHead>
            <TableHead>Срочных</TableHead>
            <TableHead>Просрочено</TableHead>
            <TableHead>Ближайший дедлайн</TableHead>
            <TableHead>Комментарий</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredProjects.length === 0 && <TableEmpty colSpan={14} />}
          {filteredProjects.map((project) => {
            const stats = taskStatsByProject.get(project.id);
            const kpi = latestKpiByProject.get(project.id);
            const nearestOverdue =
              stats?.nearestDueDate ? stats.nearestDueDate < today : false;

            return (
              <TableRow key={project.id}>
                <TableCell className="font-medium text-neutral-900">
                  <Link
                    href={`/projects/${project.id}`}
                    className="inline-flex max-w-60"
                  >
                    <ProjectBadge
                      projectId={project.id}
                      name={project.name}
                    />
                  </Link>
                </TableCell>
                <TableCell>{project.client?.name ?? "—"}</TableCell>
                <TableCell>
                  <HealthBadge health={project.health ?? "green"} />
                </TableCell>
                <TableCell>{project.responsible?.full_name ?? "—"}</TableCell>
                <TableCell>{formatCurrency(project.budget)}</TableCell>
                <TableCell>{formatCurrency(kpi?.spend)}</TableCell>
                <TableCell>{formatNumber(kpi?.leads)}</TableCell>
                <TableCell>{formatCurrency(kpi?.cpl)}</TableCell>
                <TableCell>{formatPercent(kpi?.drr)}</TableCell>
                <TableCell>{formatPercent(kpi?.romi)}</TableCell>
                <TableCell>{stats?.urgent ?? 0}</TableCell>
                <TableCell>{stats?.overdue ?? 0}</TableCell>
                <TableCell>
                  <span className={nearestOverdue ? "text-red-600" : ""}>
                    {formatDate(stats?.nearestDueDate)}
                  </span>
                </TableCell>
                <TableCell className="max-w-60 truncate text-neutral-500">
                  {project.short_comment ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
