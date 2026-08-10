import Link from "next/link";

import { ClientForm } from "@/app/(dashboard)/clients/client-form";
import { ClientStatusBadge } from "@/components/badges";
import { ProjectLogo } from "@/components/project-logo";
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

export default async function ClientsPage() {
  const supabase = await createClient();

  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("projects").select("id,name,logo_url,client_id,stage"),
  ]);

  const activeProjectsByClient = new Map<string, number>();
  const representativeProjectByClient = new Map<
    string,
    NonNullable<typeof projects>[number]
  >();
  for (const project of projects ?? []) {
    if (!project.client_id) continue;
    const current = representativeProjectByClient.get(project.client_id);
    if (!current || (current.stage !== "active" && project.stage === "active")) {
      representativeProjectByClient.set(project.client_id, project);
    }
    if (project.stage === "active") {
      activeProjectsByClient.set(
        project.client_id,
        (activeProjectsByClient.get(project.client_id) ?? 0) + 1,
      );
    }
  }
  const currentClients = (clients ?? []).filter(
    (client) => client.status !== "churned",
  );
  const finishedClients = (clients ?? []).filter(
    (client) => client.status === "churned",
  );

  const clientTable = (rows: typeof currentClients) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Клиент</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Бюджет</TableHead>
          <TableHead>Активные проекты</TableHead>
          <TableHead>Контакты</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && <TableEmpty colSpan={5} />}
        {rows.map((client) => {
          const project = representativeProjectByClient.get(client.id);
          return (
            <TableRow key={client.id}>
              <TableCell className="font-medium text-neutral-900">
                <Link
                  href={`/clients/${client.id}`}
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <ProjectLogo
                    projectId={project?.id}
                    name={project?.name ?? client.name}
                    logoUrl={project?.logo_url}
                    size="sm"
                    decorative
                  />
                  {client.name}
                </Link>
              </TableCell>
              <TableCell>
                <ClientStatusBadge status={client.status ?? "active"} />
              </TableCell>
              <TableCell>{formatCurrency(client.budget)}</TableCell>
              <TableCell>{activeProjectsByClient.get(client.id) ?? 0}</TableCell>
              <TableCell>
                {[client.phone, client.email, client.telegram]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Клиенты</h1>
        <p className="text-sm text-neutral-500">Клиенты агентства.</p>
      </div>

      <details className="group rounded-lg border border-neutral-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
          + Новый клиент
        </summary>
        <div className="mt-4">
          <ClientForm />
        </div>
      </details>

      {clientTable(currentClients)}

      {finishedClients.length > 0 && (
        <details className="group rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-700">
            Завершённые клиенты ({finishedClients.length})
          </summary>
          <div className="mt-4">{clientTable(finishedClients)}</div>
        </details>
      )}
    </div>
  );
}
