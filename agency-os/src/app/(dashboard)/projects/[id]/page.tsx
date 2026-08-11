import Link from "next/link";
import { notFound } from "next/navigation";

import { KpiForm } from "@/app/(dashboard)/projects/kpi-form";
import { NotesTabs } from "@/app/(dashboard)/projects/notes-tabs";
import { ProjectEditDisclosure } from "@/app/(dashboard)/projects/project-edit-disclosure";
import { ProjectEditForm } from "@/app/(dashboard)/projects/project-edit-form";
import { TaskForm } from "@/app/(dashboard)/tasks/task-form";
import { Avatar } from "@/components/avatar";
import {
  HealthBadge,
  PriorityBadge,
  ProjectStageBadge,
  TaskStatusBadge,
} from "@/components/badges";
import { ProjectLogo } from "@/components/project-logo";
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
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_OWNERSHIP_MODE_LABEL } from "@/lib/labels";
import { isOperationalProject } from "@/lib/project-lifecycle";
import {
  allocateTaskTime,
  type TaskTimeEntry,
} from "@/lib/time-analytics";

const LINK_LABELS: Record<string, string> = {
  website: "Сайт",
  ad_accounts: "Рекламные кабинеты",
  drive: "Материалы (Диск)",
  sheets: "Таблицы",
  reports: "Отчёты",
  telegram: "Telegram",
  notion: "Notion",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const now = new Date();

  const monthStart = new Date(now);
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthStartISO = monthStart.toISOString();

  const [
    { data: project },
    { data: members },
    { data: kpiEntries },
    { data: tasks },
    { data: notes },
    { data: profiles },
    { data: clients },
    { data: timeRows },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*, client:clients(id,name), responsible:profiles!projects_responsible_id_fkey(id,full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("project_members")
      .select("*, profile:profiles(id,full_name,position_title)")
      .eq("project_id", id),
    supabase
      .from("kpi_entries")
      .select("*")
      .eq("project_id", id)
      .order("entry_date", { ascending: false }),
    supabase
      .from("tasks")
      .select("*, assignee:profiles!tasks_assignee_id_fkey(id,full_name)")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_notes")
      .select("*, author:profiles(full_name)")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,full_name").order("full_name"),
    supabase.from("clients").select("id,name").order("name"),
    supabase
      .from("task_time_entries")
      .select(
        "id,task_id,task_title,task_type,workstream,project_id,user_id,started_at,ended_at",
      )
      .eq("project_id", id)
      .lt("started_at", now.toISOString())
      .or(`ended_at.gte.${monthStartISO},ended_at.is.null`),
  ]);

  if (!project) notFound();

  const monthAllocation = allocateTaskTime(
    (timeRows ?? []) as TaskTimeEntry[],
    {
      from: monthStart,
      to: now,
      now,
    },
  );
  const monthHours =
    (monthAllocation.byProjectSeconds.get(id) ?? 0) / 3_600;
  const perHour =
    project.monthly_fee && monthHours > 0
      ? project.monthly_fee / monthHours
      : null;

  const links = (project.links ?? {}) as Record<string, string | undefined>;
  const linkEntries = Object.entries(LINK_LABELS).filter(
    ([key]) => links[key],
  );

  return (
    <div className="flex flex-col gap-6">
      <ProjectEditDisclosure
        editor={
          <ProjectEditForm
            project={project}
            clients={(clients ?? []).map((c) => ({ id: c.id, name: c.name }))}
            profiles={(profiles ?? []).map((p) => ({
              id: p.id,
              full_name: p.full_name,
            }))}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <ProjectLogo
            projectId={project.id}
            name={project.name}
            logoUrl={project.logo_url}
            size="lg"
          />
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-neutral-900">
              {project.name}
            </h1>
            <HealthBadge health={project.health ?? "green"} />
            <ProjectStageBadge stage={project.stage ?? "active"} />
          </div>
        </div>
      </ProjectEditDisclosure>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Информация</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Row label="Клиент">
              {project.client ? (
                <Link
                  href={`/clients/${project.client.id}`}
                  className="hover:underline"
                >
                  {project.client.name}
                </Link>
              ) : (
                "—"
              )}
            </Row>
            <Row label="Ответственный">
              {project.responsible?.full_name ?? "—"}
            </Row>
            <Row label="Площадки">{project.ad_platforms ?? "—"}</Row>
            <Row label="Режим ведения">
              {project.ownership_mode
                ? PROJECT_OWNERSHIP_MODE_LABEL[project.ownership_mode] ??
                  project.ownership_mode
                : "—"}
            </Row>
            <Row label="Доход/мес">{formatCurrency(project.monthly_fee)}</Row>
            <Row label="Трудозатраты (мес)">
              {monthHours > 0 ? `${monthHours.toFixed(1)} ч` : "—"}
            </Row>
            <Row label="₽/час">{perHour ? formatCurrency(perHour) : "—"}</Row>
            <Row label="Бюджет">{formatCurrency(project.budget)}</Row>
            <Row label="Старт">{formatDate(project.started_at)}</Row>
            {project.short_comment && (
              <p className="mt-2 text-neutral-600">{project.short_comment}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ссылки</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {linkEntries.length === 0 && (
              <p className="text-neutral-400">Ссылок нет.</p>
            )}
            {linkEntries.map(([key, label]) => (
              <a
                key={key}
                href={links[key]}
                target="_blank"
                rel="noreferrer"
                className="text-neutral-700 hover:underline"
              >
                {label}
              </a>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Команда</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {(members ?? []).length === 0 && (
              <p className="text-neutral-400">Команда не назначена.</p>
            )}
            {(members ?? []).map((member) => (
              <div
                key={member.profile_id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Avatar name={member.profile?.full_name} />
                  <Link
                    href={`/employees/${member.profile_id}`}
                    className="hover:underline"
                  >
                    {member.profile?.full_name ?? "—"}
                  </Link>
                </div>
                <span className="text-xs text-neutral-400">
                  {member.role_on_project ?? member.profile?.position_title}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">KPI</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Расход</TableHead>
              <TableHead>Показы</TableHead>
              <TableHead>Клики</TableHead>
              <TableHead>Лиды</TableHead>
              <TableHead>Продажи</TableHead>
              <TableHead>Выручка</TableHead>
              <TableHead>CTR</TableHead>
              <TableHead>CPC</TableHead>
              <TableHead>CPL</TableHead>
              <TableHead>ДРР</TableHead>
              <TableHead>ROMI</TableHead>
              <TableHead>Комментарий</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(kpiEntries ?? []).length === 0 && <TableEmpty colSpan={13} />}
            {(kpiEntries ?? []).map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{formatDate(entry.entry_date)}</TableCell>
                <TableCell>{formatCurrency(entry.spend)}</TableCell>
                <TableCell>{formatNumber(entry.impressions)}</TableCell>
                <TableCell>{formatNumber(entry.clicks)}</TableCell>
                <TableCell>{formatNumber(entry.leads)}</TableCell>
                <TableCell>{formatNumber(entry.sales)}</TableCell>
                <TableCell>{formatCurrency(entry.revenue)}</TableCell>
                <TableCell>{formatPercent(entry.ctr)}</TableCell>
                <TableCell>{formatCurrency(entry.cpc)}</TableCell>
                <TableCell>{formatCurrency(entry.cpl)}</TableCell>
                <TableCell>{formatPercent(entry.drr)}</TableCell>
                <TableCell>{formatPercent(entry.romi)}</TableCell>
                <TableCell className="max-w-40 truncate text-neutral-500">
                  {entry.comment ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Card>
          <CardHeader>
            <CardTitle>Добавить запись KPI</CardTitle>
          </CardHeader>
          <CardContent>
            <KpiForm projectId={project.id} />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Задачи</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Задача</TableHead>
              <TableHead>Исполнитель</TableHead>
              <TableHead>Приоритет</TableHead>
              <TableHead>Дедлайн</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tasks ?? []).length === 0 && <TableEmpty colSpan={5} />}
            {(tasks ?? []).map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-medium text-neutral-900">
                  <Link
                    href={`/tasks?project=${project.id}&task=${task.id}`}
                    className="hover:underline"
                  >
                    {task.title}
                  </Link>
                </TableCell>
                <TableCell>{task.assignee?.full_name ?? "—"}</TableCell>
                <TableCell>
                  <PriorityBadge priority={task.priority ?? "medium"} />
                </TableCell>
                <TableCell>{formatDate(task.due_date)}</TableCell>
                <TableCell>
                  <TaskStatusBadge status={task.status ?? "todo"} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {isOperationalProject(project.stage) ? (
          <Card>
            <CardHeader>
              <CardTitle>Новая задача</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskForm
                profiles={profiles ?? []}
                defaultProjectId={project.id}
              />
            </CardContent>
          </Card>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Новые задачи отключены, пока проект находится на паузе или завершён.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Заметки</h2>
        <NotesTabs notes={notes ?? []} />
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-900">{children}</span>
    </div>
  );
}
