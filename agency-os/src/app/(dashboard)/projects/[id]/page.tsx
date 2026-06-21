import Link from "next/link";
import { notFound } from "next/navigation";

import { addKpiEntry } from "@/app/(dashboard)/projects/actions";
import { NotesTabs } from "@/app/(dashboard)/projects/notes-tabs";
import {
  HealthBadge,
  PriorityBadge,
  ProjectStageBadge,
  TaskStatusBadge,
} from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  todayISO,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const LINK_LABELS: Record<string, string> = {
  website: "Сайт",
  ad_accounts: "Рекламные кабинеты",
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

  const [
    { data: project },
    { data: members },
    { data: kpiEntries },
    { data: tasks },
    { data: notes },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*, client:clients(id,name), responsible:profiles(id,full_name)")
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
  ]);

  if (!project) notFound();

  const links = (project.links ?? {}) as Record<string, string | undefined>;
  const linkEntries = Object.entries(LINK_LABELS).filter(
    ([key]) => links[key],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {project.name}
        </h1>
        <HealthBadge health={project.health ?? "green"} />
        <ProjectStageBadge stage={project.stage ?? "active"} />
      </div>

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
                <Link
                  href={`/employees/${member.profile_id}`}
                  className="hover:underline"
                >
                  {member.profile?.full_name ?? "—"}
                </Link>
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
            <form
              action={addKpiEntry.bind(null, project.id)}
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              <Field label="Дата" name="entry_date" type="date" defaultValue={todayISO()} required />
              <Field label="Расход" name="spend" type="number" step="0.01" />
              <Field label="Показы" name="impressions" type="number" />
              <Field label="Клики" name="clicks" type="number" />
              <Field label="Лиды" name="leads" type="number" />
              <Field label="Продажи" name="sales" type="number" />
              <Field label="Выручка" name="revenue" type="number" step="0.01" />
              <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
                <Label htmlFor="comment">Комментарий</Label>
                <Textarea id="comment" name="comment" rows={2} />
              </div>
              <div className="col-span-2 sm:col-span-4">
                <Button type="submit">Добавить запись</Button>
              </div>
            </form>
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

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
