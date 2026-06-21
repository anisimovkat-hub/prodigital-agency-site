import Link from "next/link";

import { ClientStatusBadge } from "@/components/badges";
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
    supabase.from("projects").select("client_id,stage"),
  ]);

  const activeProjectsByClient = new Map<string, number>();
  for (const project of projects ?? []) {
    if (!project.client_id || project.stage !== "active") continue;
    activeProjectsByClient.set(
      project.client_id,
      (activeProjectsByClient.get(project.client_id) ?? 0) + 1,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Клиенты</h1>
        <p className="text-sm text-neutral-500">Клиенты агентства.</p>
      </div>

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
          {(clients ?? []).length === 0 && <TableEmpty colSpan={5} />}
          {(clients ?? []).map((client) => (
            <TableRow key={client.id}>
              <TableCell className="font-medium text-neutral-900">
                <Link
                  href={`/clients/${client.id}`}
                  className="hover:underline"
                >
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
