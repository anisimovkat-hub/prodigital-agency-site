import Link from "next/link";

import { FilterSelect } from "@/components/filter-select";
import { HealthBadge } from "@/components/badges";
import { PersonalCalendarSchedule } from "@/components/personal-calendar";
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
import {
  dateISOInTimeZone,
} from "@/lib/calendar-events";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  todayISO,
} from "@/lib/format";
import { getPersonalCalendarEvents } from "@/lib/google-calendar";
import { PROJECT_HEALTH_LABEL } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { sortProjectsForDisplay } from "@/lib/project-order";
import { isActiveTaskStatus } from "@/lib/task-status";
import type { Enums } from "@/lib/supabase/types";

type DashTask = {
  id: string;
  title: string;
  status: Enums<"task_status"> | null;
  due_date: string | null;
  is_urgent: boolean | null;
  assignee_id: string | null;
  creator_id: string | null;
  project_id: string | null;
  assignee: { id: string; full_name: string } | null;
  project: { id: string; name: string } | null;
};

function DayTaskRow({ task, today }: { task: DashTask; today: string }) {
  const overdue = !!task.due_date && task.due_date < today;
  return (
    <li className="flex items-center gap-2 py-2">
      <Link
        href={`/tasks?task=${task.id}`}
        className="min-w-0 flex-1 truncate text-sm text-neutral-800 hover:underline"
      >
        {task.title}
      </Link>
      <ProjectBadge
        projectId={task.project?.id}
        name={task.project?.name ?? "Личное"}
        className="max-w-36 shrink-0"
      />
      <span
        className={`shrink-0 text-xs ${overdue ? "text-red-600" : "text-neutral-500"}`}
      >
        {formatDate(task.due_date)}
      </span>
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
        "id,project_id,title,status,due_date,is_urgent,assignee_id,creator_id, assignee:profiles!tasks_assignee_id_fkey(id,full_name), project:projects(id,name)",
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
  const todayTasksCount = (tasks ?? []).filter(
    (task) => isActiveTaskStatus(task.status) && task.due_date === today,
  ).length;
  const overdueTasksCount = (tasks ?? []).filter(
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
  for (const task of tasks ?? []) {
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
  const allTasks = (tasks ?? []) as unknown as DashTask[];
  const isOpen = (t: DashTask) => isActiveTaskStatus(t.status);
  const byDue = (a: DashTask, b: DashTask) =>
    (a.due_date ?? "9999") < (b.due_date ?? "9999") ? -1 : 1;

  const myToday = allTasks
    .filter((t) => isOpen(t) && t.assignee_id === uid && t.due_date === today)
    .sort(byDue);

  const myOverdue = allTasks
    .filter(
      (t) =>
        isOpen(t) && t.assignee_id === uid && !!t.due_date && t.due_date < today,
    )
    .sort(byDue);

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

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">
            Требует внимания
          </h2>
          {attention.length === 0 ? (
            <p className="rounded-md bg-emerald-50 px-3 py-4 text-center text-sm font-medium text-emerald-700">
              Всё под контролем 👍
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {attention.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${attentionTones[item.tone]}`}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">
                Мой день
              </h2>
              <span className="text-xs text-neutral-400">
                сегодня и просроченное
              </span>
            </div>
            {calendar && calendar.events.length > 0 && (
              <PersonalCalendarSchedule
                events={calendar.events}
                timeZone={calendar.timeZone}
                title="Расписание"
                compact
                className="mb-4 border-b border-neutral-100 pb-4"
              />
            )}
            {myOverdue.length > 0 && (
              <div className="mb-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-red-500">
                  Просрочено · {myOverdue.length}
                </p>
                <ul className="flex flex-col divide-y divide-neutral-100">
                  {myOverdue.map((task) => (
                    <DayTaskRow key={task.id} task={task} today={today} />
                  ))}
                </ul>
              </div>
            )}
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Сегодня
            </p>
            {myToday.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">
                На сегодня задач нет 🎉
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-neutral-100">
                {myToday.map((task) => (
                  <DayTaskRow key={task.id} task={task} today={today} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">
              Просрочено без отчёта
            </h2>
            {staleDelegated.length === 0 ? (
              <p className="py-6 text-center text-sm text-neutral-400">
                Все делегированные задачи под контролем 👍
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-neutral-100">
                {staleDelegated.map((task) => (
                  <li key={task.id} className="flex items-center gap-2 py-2">
                    <Link
                      href={`/tasks?task=${task.id}`}
                      className="min-w-0 flex-1 truncate text-sm text-neutral-800 hover:underline"
                    >
                      {task.title}
                    </Link>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {task.assignee?.full_name?.split(" ")[0] ?? "—"}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-red-600">
                      {formatDate(task.due_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

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
              {teamLoad.length === 0 && <TableEmpty colSpan={5} />}
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
                    className={row.overdue > 0 ? "font-medium text-red-600" : ""}
                  >
                    {row.overdue}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
