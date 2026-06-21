import Link from "next/link";

import { HealthBadge, ProjectStageBadge } from "@/components/badges";
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

export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("*, client:clients(id,name), responsible:profiles(id,full_name)")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Проекты</h1>
        <p className="text-sm text-neutral-500">
          Все проекты агентства.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Проект</TableHead>
            <TableHead>Клиент</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Стадия</TableHead>
            <TableHead>Ответственный</TableHead>
            <TableHead>Бюджет</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(projects ?? []).length === 0 && <TableEmpty colSpan={6} />}
          {(projects ?? []).map((project) => (
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
              <TableCell>
                <ProjectStageBadge stage={project.stage ?? "active"} />
              </TableCell>
              <TableCell>{project.responsible?.full_name ?? "—"}</TableCell>
              <TableCell>{formatCurrency(project.budget)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
