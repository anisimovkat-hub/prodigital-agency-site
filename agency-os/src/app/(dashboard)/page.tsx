import Link from "next/link";

import { FilterSelect } from "@/components/filter-select";
import { HealthBadge } from "@/components/badges";
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
  todayISO,
} from "@/lib/format";
import { PROJECT_HEALTH_LABEL } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ health?: string; client?: string }>;
}) {
  const { health, client } = await searchParams;
  const supabase = await createClient();

  const [{ data: projects }, { data: clients }, { data: tasks }, { data: kpiEntries }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*, client:clients(id,name), responsible:profiles(id,full_name)")
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
      supabase
        .from("tasks")
        .select("id,project_id,status,due_date,is_urgent"),
      supabase
        .from("kpi_entries")
        .select("*")
        .order("entry_date", { ascending: false }),
    ]);

  const today = todayISO();

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
    const open = task.status !== "done";
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

  const filteredProjects = (projects ?? []).filter((project) => {
    if (health && project.health !== health) return false;
    if (client && project.client_id !== client) return false;
    return true;
  });

  const healthOptions = (
    Object.keys(PROJECT_HEALTH_LABEL) as Enums<"project_health">[]
  ).map((value) => ({ value, label: PROJECT_HEALTH_LABEL[value] }));

  const clientOptions = (clients ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Дашборд</h1>
        <p className="text-sm text-neutral-500">
          Проекты агентства, статусы и ключевые показатели.
        </p>
      </div>

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
                    className="hover:underline"
                  >
                    {project.name}
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
