"use client";

import Link from "next/link";

import { ProjectQuickSelect } from "@/app/(dashboard)/projects/project-quick-select";
import { ProjectResponsibleSelect } from "@/app/(dashboard)/projects/project-responsible-select";
import {
  FilterableReorderableTable,
  type FilterableTableColumn,
} from "@/components/filterable-reorderable-table";
import { ProjectBadge } from "@/components/project-badge";
import { formatCurrency } from "@/lib/format";
import { PROJECT_HEALTH_LABEL, PROJECT_STAGE_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/types";

type Profile = { id: string; full_name: string };

export type ProjectListRow = {
  id: string;
  name: string;
  logo_url: string | null;
  client: { id: string; name: string } | null;
  health: Enums<"project_health"> | null;
  stage: Enums<"project_stage"> | null;
  monthly_fee: number | null;
  budget: number | null;
  monthlyHours: number;
  responsibles: Profile[];
};

const COLUMNS: FilterableTableColumn<ProjectListRow, ProjectColumnId>[] = [
  {
    id: "project",
    label: "Проект",
    sortValue: (project) => project.name,
    filterValue: (project) => project.name,
    cell: (project) => (
      <Link href={`/projects/${project.id}`} className="inline-flex max-w-60">
        <ProjectBadge projectId={project.id} name={project.name} logoUrl={project.logo_url} />
      </Link>
    ),
    className: "font-medium text-neutral-900",
  },
  {
    id: "client",
    label: "Клиент",
    sortValue: (project) => project.client?.name ?? null,
    filterValue: (project) => project.client?.name ?? null,
    cell: (project) => project.client?.name ?? "—",
  },
  {
    id: "health",
    label: "Статус",
    sortValue: (project) => project.health ?? null,
    filterValue: (project) => project.health ? PROJECT_HEALTH_LABEL[project.health] : null,
    cell: (project) => (
      <ProjectQuickSelect
        projectId={project.id}
        projectName={project.name}
        field="health"
        value={project.health ?? "green"}
      />
    ),
  },
  {
    id: "stage",
    label: "Стадия",
    sortValue: (project) => project.stage ?? null,
    filterValue: (project) => project.stage ? PROJECT_STAGE_LABEL[project.stage] : null,
    cell: (project) => (
      <ProjectQuickSelect
        projectId={project.id}
        projectName={project.name}
        field="stage"
        value={project.stage ?? "active"}
      />
    ),
  },
  {
    id: "responsibles",
    label: "Ответственные",
    sortValue: (project) => responsibleLabel(project) || null,
    filterValue: (project) => responsibleLabel(project) || null,
    cell: (project) => (
      <ProjectResponsibleSelect
        key={`${project.id}-${project.responsibles.map((profile) => profile.id).join("-") || "none"}`}
        projectId={project.id}
        projectName={project.name}
        profiles={[]}
        selectedResponsibles={project.responsibles}
      />
    ),
  },
  {
    id: "monthly_fee",
    label: "Доход/мес",
    sortValue: (project) => project.monthly_fee,
    filterValue: (project) => project.monthly_fee === null ? null : formatCurrency(project.monthly_fee),
    initialSortDirection: "desc",
    cell: (project) => formatCurrency(project.monthly_fee),
  },
  {
    id: "hours",
    label: "Трудозатраты, мес",
    sortValue: (project) => project.monthlyHours || null,
    filterValue: (project) => project.monthlyHours > 0 ? formatHours(project.monthlyHours) : null,
    initialSortDirection: "desc",
    cell: (project) => formatHours(project.monthlyHours),
  },
  {
    id: "budget",
    label: "Бюджет",
    sortValue: (project) => project.budget,
    filterValue: (project) => project.budget === null ? null : formatCurrency(project.budget),
    initialSortDirection: "desc",
    cell: (project) => formatCurrency(project.budget),
  },
];

type ProjectColumnId =
  | "project"
  | "client"
  | "health"
  | "stage"
  | "responsibles"
  | "monthly_fee"
  | "hours"
  | "budget";

export function ProjectsTable({
  rows,
  profiles,
  storageKey,
}: {
  rows: ProjectListRow[];
  profiles: Profile[];
  storageKey: string;
}) {
  const columns = COLUMNS.map((column) =>
    column.id === "responsibles"
      ? {
          ...column,
          cell: (project: ProjectListRow) => (
            <ProjectResponsibleSelect
              key={`${project.id}-${project.responsibles.map((profile) => profile.id).join("-") || "none"}`}
              projectId={project.id}
              projectName={project.name}
              profiles={profiles}
              selectedResponsibles={project.responsibles}
            />
          ),
        }
      : column,
  );

  return (
    <FilterableReorderableTable
      columns={columns}
      rows={rows}
      rowKey={(project) => project.id}
      storageKey={storageKey}
      minWidthClassName="min-w-[1180px]"
    />
  );
}

function responsibleLabel(project: ProjectListRow) {
  return project.responsibles.map((profile) => profile.full_name).join(", ");
}

function formatHours(hours: number): string {
  if (hours <= 0) return "—";
  return `${hours.toFixed(1).replace(".", ",")} ч`;
}
