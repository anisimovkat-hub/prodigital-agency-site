"use client";

import Link from "next/link";

import { ClientStatusBadge } from "@/components/badges";
import {
  FilterableReorderableTable,
  type FilterableTableColumn,
} from "@/components/filterable-reorderable-table";
import { ProjectLogo } from "@/components/project-logo";
import { formatCurrency } from "@/lib/format";
import { CLIENT_STATUS_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/types";

export type ClientListRow = {
  id: string;
  name: string;
  status: Enums<"client_status"> | null;
  budget: number | null;
  activeProjects: number;
  contacts: string | null;
  representativeProject: { id: string; name: string; logo_url: string | null } | null;
};

type ClientColumnId =
  | "client"
  | "status"
  | "budget"
  | "active_projects"
  | "contacts";

const COLUMNS: FilterableTableColumn<ClientListRow, ClientColumnId>[] = [
  {
    id: "client",
    label: "Клиент",
    sortValue: (client) => client.name,
    filterValue: (client) => client.name,
    className: "font-medium text-neutral-900",
    cell: (client) => (
      <Link href={`/clients/${client.id}`} className="inline-flex items-center gap-2 hover:underline">
        <ProjectLogo
          projectId={client.representativeProject?.id}
          name={client.representativeProject?.name ?? client.name}
          logoUrl={client.representativeProject?.logo_url}
          size="sm"
          decorative
        />
        {client.name}
      </Link>
    ),
  },
  {
    id: "status",
    label: "Статус",
    sortValue: (client) => client.status ?? null,
    filterValue: (client) => client.status ? CLIENT_STATUS_LABEL[client.status] : null,
    cell: (client) => <ClientStatusBadge status={client.status ?? "active"} />,
  },
  {
    id: "budget",
    label: "Бюджет",
    sortValue: (client) => client.budget,
    filterValue: (client) => client.budget === null ? null : formatCurrency(client.budget),
    initialSortDirection: "desc",
    cell: (client) => formatCurrency(client.budget),
  },
  {
    id: "active_projects",
    label: "Активные проекты",
    sortValue: (client) => client.activeProjects,
    filterValue: (client) => String(client.activeProjects),
    initialSortDirection: "desc",
    cell: (client) => client.activeProjects,
  },
  {
    id: "contacts",
    label: "Контакты",
    sortValue: (client) => client.contacts,
    filterValue: (client) => client.contacts,
    cell: (client) => client.contacts ?? "—",
  },
];

export function ClientsTable({
  rows,
  storageKey,
}: {
  rows: ClientListRow[];
  storageKey: string;
}) {
  return (
    <FilterableReorderableTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(client) => client.id}
      storageKey={storageKey}
      minWidthClassName="min-w-[860px]"
    />
  );
}
