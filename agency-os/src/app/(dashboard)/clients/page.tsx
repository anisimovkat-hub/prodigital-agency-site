import { ClientForm } from "@/app/(dashboard)/clients/client-form";
import {
  ClientsTable,
  type ClientListRow,
} from "@/app/(dashboard)/clients/clients-table";
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
    if (
      !current ||
      (current.stage !== "active" && current.stage !== "launching" &&
        (project.stage === "active" || project.stage === "launching"))
    ) {
      representativeProjectByClient.set(project.client_id, project);
    }
    if (project.stage === "active" || project.stage === "launching") {
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

  const clientRows = (rows: typeof currentClients): ClientListRow[] =>
    rows.map((client) => {
      const project = representativeProjectByClient.get(client.id);
      return {
        id: client.id,
        name: client.name,
        status: client.status,
        budget: client.budget,
        activeProjects: activeProjectsByClient.get(client.id) ?? 0,
        contacts:
          [client.phone, client.email, client.telegram].filter(Boolean).join(" · ") || null,
        representativeProject: project
          ? { id: project.id, name: project.name, logo_url: project.logo_url }
          : null,
      };
    });

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

      <ClientsTable
        rows={clientRows(currentClients)}
        storageKey="agency-os:clients-column-order"
      />

      {finishedClients.length > 0 && (
        <details className="group rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-700">
            Завершённые клиенты ({finishedClients.length})
          </summary>
          <div className="mt-4">
            <ClientsTable
              rows={clientRows(finishedClients)}
              storageKey="agency-os:clients-column-order"
            />
          </div>
        </details>
      )}
    </div>
  );
}
