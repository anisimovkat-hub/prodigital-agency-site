import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientEditForm } from "@/app/(dashboard)/clients/client-edit-form";
import { ClientStatusBadge, HealthBadge, ProjectStageBadge } from "@/components/badges";
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
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const LINK_LABELS: Record<string, string> = {
  website: "Сайт",
  ad_accounts: "Рекламные кабинеты",
  sheets: "Таблицы",
  reports: "Отчёты",
  telegram: "Telegram",
  notion: "Notion",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("projects")
      .select("*, responsible:profiles!projects_responsible_id_fkey(full_name)")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!client) notFound();

  const links = (client.links ?? {}) as Record<string, string | undefined>;
  const linkEntries = Object.entries(LINK_LABELS).filter(([key]) => links[key]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {client.name}
        </h1>
        <ClientStatusBadge status={client.status ?? "active"} />
      </div>

      <details className="group rounded-lg border border-neutral-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
          Редактировать клиента
        </summary>
        <div className="mt-4">
          <ClientEditForm client={client} />
        </div>
      </details>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Информация</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Row label="Бюджет">{formatCurrency(client.budget)}</Row>
            <Row label="Телефон">{client.phone ?? "—"}</Row>
            <Row label="Email">{client.email ?? "—"}</Row>
            <Row label="Telegram">{client.telegram ?? "—"}</Row>
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
            <CardTitle>Заметки</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-700">
            {client.notes ?? <span className="text-neutral-400">Нет заметок.</span>}
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Проекты</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Проект</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Стадия</TableHead>
              <TableHead>Ответственный</TableHead>
              <TableHead>Бюджет</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(projects ?? []).length === 0 && <TableEmpty colSpan={5} />}
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
