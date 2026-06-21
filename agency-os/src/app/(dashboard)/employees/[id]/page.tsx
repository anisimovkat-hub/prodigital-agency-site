import Link from "next/link";
import { notFound } from "next/navigation";

import { PriorityBadge, ProjectStageBadge, TaskStatusBadge } from "@/components/badges";
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
import { formatDate, todayISO } from "@/lib/format";
import { USER_ROLE_LABEL } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: members }, { data: tasks }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("project_members")
        .select("*, project:projects(id,name,stage,client:clients(name))")
        .eq("profile_id", id),
      supabase
        .from("tasks")
        .select("*, project:projects(id,name)")
        .eq("assignee_id", id)
        .order("due_date"),
    ]);

  if (!profile) notFound();

  const today = todayISO();
  const openTasks = (tasks ?? []).filter((t) => t.status !== "done");
  const todayTasks = openTasks.filter((t) => t.due_date === today);
  const overdueTasks = openTasks.filter(
    (t) => t.due_date && t.due_date < today,
  );
  const activeProjects = (members ?? []).filter(
    (m) => m.project?.stage === "active",
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          {profile.full_name}
        </h1>
        <p className="text-sm text-neutral-500">
          {USER_ROLE_LABEL[profile.role]}
          {profile.position_title ? ` · ${profile.position_title}` : ""}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Контакты</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Row label="Email">{profile.email ?? "—"}</Row>
            <Row label="Телефон">{profile.phone ?? "—"}</Row>
            <Row label="Telegram">{profile.telegram ?? "—"}</Row>
            <Row label="Активен">{profile.is_active ? "Да" : "Нет"}</Row>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Загрузка</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Row label="Активные проекты">{activeProjects.length}</Row>
            <Row label="Задачи на сегодня">{todayTasks.length}</Row>
            <Row label="Просроченные">{overdueTasks.length}</Row>
            <Row label="Открытых задач всего">{openTasks.length}</Row>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Активные проекты</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {activeProjects.length === 0 && (
              <p className="text-neutral-400">Нет активных проектов.</p>
            )}
            {activeProjects.map((member) => (
              <div key={member.project_id} className="flex flex-col">
                <Link
                  href={`/projects/${member.project_id}`}
                  className="hover:underline"
                >
                  {member.project?.name}
                </Link>
                <span className="text-xs text-neutral-400">
                  {member.project?.client?.name}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Задачи</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Задача</TableHead>
              <TableHead>Проект</TableHead>
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
                    href={`/tasks?task=${task.id}`}
                    className="hover:underline"
                  >
                    {task.title}
                  </Link>
                </TableCell>
                <TableCell>{task.project?.name ?? "—"}</TableCell>
                <TableCell>
                  <PriorityBadge priority={task.priority ?? "medium"} />
                </TableCell>
                <TableCell>
                  <span
                    className={
                      task.due_date &&
                      task.due_date < today &&
                      task.status !== "done"
                        ? "text-red-600"
                        : ""
                    }
                  >
                    {formatDate(task.due_date)}
                  </span>
                </TableCell>
                <TableCell>
                  <TaskStatusBadge status={task.status ?? "todo"} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {(members ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            Все проекты
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Проект</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead>Стадия</TableHead>
                <TableHead>Роль на проекте</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(members ?? []).map((member) => (
                <TableRow key={member.project_id}>
                  <TableCell className="font-medium text-neutral-900">
                    <Link
                      href={`/projects/${member.project_id}`}
                      className="hover:underline"
                    >
                      {member.project?.name}
                    </Link>
                  </TableCell>
                  <TableCell>{member.project?.client?.name ?? "—"}</TableCell>
                  <TableCell>
                    <ProjectStageBadge stage={member.project?.stage ?? "active"} />
                  </TableCell>
                  <TableCell>{member.role_on_project ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
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
