import Link from "next/link";

import { ProjectForm } from "@/app/(dashboard)/projects/project-form";
import { HealthBadge, ProjectStageBadge } from "@/components/badges";
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
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  allocateTaskTime,
  type TaskTimeEntry,
} from "@/lib/time-analytics";

function formatHours(hours: number): string {
  if (hours <= 0) return "—";
  return `${hours.toFixed(1).replace(".", ",")} ч`;
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const now = new Date();

  const monthStart = new Date(now);
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ data: projects }, { data: clients }, { data: profiles }, { data: timeRows }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*, client:clients(id,name), responsible:profiles!projects_responsible_id_fkey(id,full_name)")
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
      supabase
        .from("task_time_entries")
        .select(
          "id,task_id,task_title,task_type,workstream,project_id,user_id,started_at,ended_at",
        )
        .lt("started_at", now.toISOString())
        .or(`ended_at.gte.${monthStart.toISOString()},ended_at.is.null`),
    ]);

  const allocation = allocateTaskTime((timeRows ?? []) as TaskTimeEntry[], {
    from: monthStart,
    to: now,
    now,
  });
  const hoursByProject = new Map(
    [...allocation.byProjectSeconds].map(([projectId, seconds]) => [
      projectId,
      seconds / 3_600,
    ]),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Проекты</h1>
        <p className="text-sm text-neutral-500">
          Все проекты агентства.
        </p>
      </div>

      <details className="group rounded-lg border border-neutral-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
          + Новый проект
        </summary>
        <div className="mt-4">
          <ProjectForm
            clients={(clients ?? []).map((c) => ({ id: c.id, name: c.name }))}
            profiles={(profiles ?? []).map((p) => ({
              id: p.id,
              full_name: p.full_name,
            }))}
          />
        </div>
      </details>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Проект</TableHead>
            <TableHead>Клиент</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Стадия</TableHead>
            <TableHead>Ответственный</TableHead>
            <TableHead>Доход/мес</TableHead>
            <TableHead>Трудозатраты, мес</TableHead>
            <TableHead>Бюджет</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(projects ?? []).length === 0 && <TableEmpty colSpan={8} />}
          {(projects ?? []).map((project) => (
            <TableRow key={project.id}>
              <TableCell className="font-medium text-neutral-900">
                <Link
                  href={`/projects/${project.id}`}
                  className="inline-flex max-w-60"
                >
                  <ProjectBadge
                    projectId={project.id}
                    name={project.name}
                    logoUrl={project.logo_url}
                  />
                </Link>
              </TableCell>
              <TableCell>{project.client?.name ?? "—"}</TableCell>
              <TableCell>
                <HealthBadge health={project.health ?? "green"} />
              </TableCell>
              <TableCell>
                <ProjectStageBadge stage={project.stage ?? "active"} />
              </TableCell>
              <TableCell>{project.responsible?.full_name ?? "—"}</TableCell>
              <TableCell>{formatCurrency(project.monthly_fee)}</TableCell>
              <TableCell>{formatHours(hoursByProject.get(project.id) ?? 0)}</TableCell>
              <TableCell>{formatCurrency(project.budget)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
