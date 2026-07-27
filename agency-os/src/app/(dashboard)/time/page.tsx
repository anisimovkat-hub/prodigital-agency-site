import Link from "next/link";

import { ProjectBadge } from "@/components/project-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDuration } from "@/lib/format";
import { TASK_TYPE_LABEL } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import {
  allocateTaskTime,
  type TaskTimeEntry,
} from "@/lib/time-analytics";
import { cn } from "@/lib/utils";

type TimeSearchParams = {
  period?: string;
};

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<TimeSearchParams>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period = rawPeriod === "month" ? "month" : "week";
  const now = new Date();
  const from = period === "week" ? startOfUtcWeek(now) : startOfUtcMonth(now);

  const supabase = await createClient();
  const [{ data: rows }, { data: projects }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("task_time_entries")
        .select(
          "id,task_id,task_title,task_type,workstream,project_id,user_id,started_at,ended_at",
        )
        .lt("started_at", now.toISOString())
        .or(`ended_at.gte.${from.toISOString()},ended_at.is.null`)
        .order("started_at", { ascending: true }),
      supabase.from("projects").select("id,name").order("name"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
    ]);

  const entries = (rows ?? []) as TaskTimeEntry[];
  const allocation = allocateTaskTime(entries, {
    from,
    to: now,
    now,
  });
  const projectNames = new Map(
    (projects ?? []).map((project) => [project.id, project.name]),
  );
  const profileNames = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name]),
  );
  const taskMeta = new Map<
    string,
    {
      title: string;
      taskType: string | null;
      workstream: string | null;
      projectId: string | null;
      userId: string | null;
    }
  >();
  const activeTaskIds = new Set<string>();
  for (const entry of entries) {
    taskMeta.set(entry.task_id, {
      title: entry.task_title,
      taskType: entry.task_type,
      workstream: entry.workstream,
      projectId: entry.project_id,
      userId: entry.user_id,
    });
    if (!entry.ended_at) activeTaskIds.add(entry.task_id);
  }

  const taskRows = [...allocation.byTaskSeconds]
    .map(([taskId, seconds]) => ({
      taskId,
      seconds,
      meta: taskMeta.get(taskId),
      active: activeTaskIds.has(taskId),
    }))
    .filter((row) => row.meta)
    .sort((a, b) => b.seconds - a.seconds);
  const taskIdsByProject = new Map<string, Set<string>>();
  for (const row of taskRows) {
    const projectId = row.meta?.projectId ?? "personal";
    const ids = taskIdsByProject.get(projectId) ?? new Set<string>();
    ids.add(row.taskId);
    taskIdsByProject.set(projectId, ids);
  }
  const projectRows = [...allocation.byProjectSeconds]
    .map(([projectId, seconds]) => ({
      projectId,
      name: projectNames.get(projectId) ?? "Проект удалён",
      seconds,
      taskCount: taskIdsByProject.get(projectId)?.size ?? 0,
    }))
    .sort((a, b) => b.seconds - a.seconds);
  const personalSeconds = taskRows
    .filter((row) => !row.meta?.projectId)
    .reduce((sum, row) => sum + row.seconds, 0);
  if (personalSeconds > 0) {
    projectRows.push({
      projectId: "personal",
      name: "Личное / без проекта",
      seconds: personalSeconds,
      taskCount: taskIdsByProject.get("personal")?.size ?? 0,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Трудозатраты
          </h1>
          <p className="text-sm text-neutral-500">
            Автоматическое время задач с {formatDate(from.toISOString())} по{" "}
            {formatDate(now.toISOString())}.
          </p>
        </div>
        <div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          <PeriodLink href="/time" active={period === "week"}>
            Неделя
          </PeriodLink>
          <PeriodLink href="/time?period=month" active={period === "month"}>
            Месяц
          </PeriodLink>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Учтено рабочего времени"
          value={formatSeconds(allocation.totalSeconds)}
          accent="border-l-blue-500"
        />
        <MetricCard
          title="Задач в периоде"
          value={String(taskRows.length)}
          accent="border-l-violet-500"
        />
        <MetricCard
          title="Сейчас в работе"
          value={String(activeTaskIds.size)}
          accent="border-l-amber-500"
        />
        <MetricCard
          title="Проектов"
          value={String(projectRows.length)}
          accent="border-l-emerald-500"
        />
      </div>

      <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Если один сотрудник ведёт несколько задач одновременно, каждый общий
        отрезок времени делится между ними поровну. Поэтому итог не удваивает
        рабочий день.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">По проектам</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Проект</TableHead>
              <TableHead>Задач</TableHead>
              <TableHead>Доля времени</TableHead>
              <TableHead className="text-right">Трудозатраты</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectRows.length === 0 && (
              <TableEmpty colSpan={4}>
                В выбранном периоде пока нет учтённого времени.
              </TableEmpty>
            )}
            {projectRows.map((row) => (
              <TableRow key={row.projectId}>
                <TableCell>
                  {row.projectId === "personal" ? (
                    <ProjectBadge projectId={null} name={null} />
                  ) : (
                    <Link href={`/projects/${row.projectId}`}>
                      <ProjectBadge
                        projectId={row.projectId}
                        name={row.name}
                      />
                    </Link>
                  )}
                </TableCell>
                <TableCell>{row.taskCount}</TableCell>
                <TableCell>
                  {allocation.totalSeconds > 0
                    ? `${Math.round((row.seconds / allocation.totalSeconds) * 100)}%`
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatSeconds(row.seconds)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">По задачам</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Задача</TableHead>
              <TableHead>Проект</TableHead>
              <TableHead>Исполнитель</TableHead>
              <TableHead>Тип / направление</TableHead>
              <TableHead className="text-right">Трудозатраты</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taskRows.length === 0 && <TableEmpty colSpan={5} />}
            {taskRows.map(({ taskId, seconds, meta, active }) => (
              <TableRow key={taskId}>
                <TableCell className="font-medium text-neutral-900">
                  <span className="inline-flex items-center gap-2">
                    {meta!.title}
                    {active && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        В работе
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <ProjectBadge
                    projectId={meta!.projectId}
                    name={
                      meta!.projectId
                        ? projectNames.get(meta!.projectId)
                        : null
                    }
                  />
                </TableCell>
                <TableCell>
                  {meta!.userId
                    ? profileNames.get(meta!.userId) ?? "—"
                    : "Не назначен"}
                </TableCell>
                <TableCell>
                  {meta!.taskType
                    ? TASK_TYPE_LABEL[
                        meta!.taskType as keyof typeof TASK_TYPE_LABEL
                      ]
                    : "—"}
                  {meta!.workstream ? ` · ${meta!.workstream}` : ""}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatSeconds(seconds)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className={cn("border-l-4", accent)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-neutral-500">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-neutral-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function PeriodLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-white text-neutral-900 shadow-sm"
          : "text-neutral-500 hover:text-neutral-900",
      )}
    >
      {children}
    </Link>
  );
}

function startOfUtcWeek(value: Date): Date {
  const result = new Date(value);
  const daysSinceMonday = (result.getUTCDay() + 6) % 7;
  result.setUTCDate(result.getUTCDate() - daysSinceMonday);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function startOfUtcMonth(value: Date): Date {
  const result = new Date(value);
  result.setUTCDate(1);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function formatSeconds(seconds: number): string {
  return formatDuration(Math.round(seconds / 60));
}
