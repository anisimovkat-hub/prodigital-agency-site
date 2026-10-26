import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Plus } from "lucide-react";

import { ClientEditForm } from "@/app/(dashboard)/clients/client-edit-form";
import { ClientStatusSelect } from "@/app/(dashboard)/clients/client-status-select";
import { ProjectQuickSelect } from "@/app/(dashboard)/projects/project-quick-select";
import { ProjectForm } from "@/app/(dashboard)/projects/project-form";
import { ClientStatusBadge } from "@/components/badges";
import { ProjectBadge } from "@/components/project-badge";
import { ProjectLogo } from "@/components/project-logo";
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
import { sortProjectsForDisplay } from "@/lib/project-order";
import { createClient } from "@/lib/supabase/server";
import { directionReportHref, type AdDirection } from "@/lib/yandex-goals";

const LINK_LABELS: Record<string, string> = {
  website: "Сайт",
  ad_accounts: "Рекламные кабинеты",
  drive: "Материалы (Диск)",
  sheets: "Таблицы",
  reports: "Отчёты",
  telegram: "Telegram",
  notion: "Notion",
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: client }, { data: projects }, { data: profiles }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("projects")
      .select("*, responsible:profiles!projects_responsible_id_fkey(full_name)")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,full_name,role").order("full_name"),
  ]);

  if (!client) notFound();
  const canManage = profiles?.some((profile) => profile.id === user?.id && profile.role === "owner") ?? false;
  const directionsResult = canManage && projects?.length
    ? await supabase.from("project_ad_directions").select("*").in("project_id", projects.map((project) => project.id)).order("name")
    : { data: [], error: null };
  const activeProjectIds = new Set((projects ?? []).filter((project) => project.stage === "active" || project.stage === "launching").map((project) => project.id));
  const directions = ((directionsResult.data ?? []) as AdDirection[]).filter((direction) => direction.is_active && activeProjectIds.has(direction.project_id));

  const links = (client.links ?? {}) as Record<string, string | undefined>;
  const linkEntries = Object.entries(LINK_LABELS).filter(([key]) => links[key]);
  const sortedProjects = sortProjectsForDisplay(projects ?? []);
  const representativeProject =
    sortedProjects.find(
      (project) =>
        project.stage === "active" || project.stage === "launching",
    ) ?? sortedProjects[0];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/clients" className="inline-flex w-fit items-center gap-2 rounded-md py-1 text-sm text-neutral-600 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
        <ArrowLeft className="size-4" aria-hidden="true" />Вернуться назад ко всем клиентам
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <ProjectLogo
          projectId={representativeProject?.id}
          name={representativeProject?.name ?? client.name}
          logoUrl={representativeProject?.logo_url}
          size="lg"
          decorative
        />
        <h1 className="text-2xl font-semibold text-neutral-900">
          {client.name}
        </h1>
        {canManage
          ? <ClientStatusSelect clientId={client.id} clientName={client.name} value={client.status ?? "active"} />
          : <ClientStatusBadge status={client.status ?? "active"} />}
      </div>

      {query.new === "1" && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Клиент создан. Добавьте первый проект ниже — он сразу появится в этой карточке.</p>}

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

      {directionsResult.error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Не удалось загрузить отчёты направлений. Обновите страницу.</p>}
      {directions.length > 0 && <section id="reports" className="space-y-3" aria-label="Отчётность по направлениям">
        <div><h2 className="text-lg font-semibold text-neutral-900">Отчётность по направлениям</h2><p className="mt-1 text-sm text-neutral-500">Отдельный дашборд для каждого сайта: свои кампании, расходы и цели.</p></div>
        <div className="grid gap-3 md:grid-cols-3">
          {directions.map((direction) => <Link key={direction.id} href={directionReportHref(direction)} className="group rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
            <h3 className="font-semibold text-neutral-900">{direction.name}</h3>
            <p className="mt-2 break-words text-xs text-neutral-500">{direction.websites[0]?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "Сайт не указан"}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-800">Открыть отчёт <ArrowUpRight className="size-4" aria-hidden="true" /></span>
          </Link>)}
        </div>
      </section>}

      <section id="projects" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Проекты</h2>
        {canManage && <details open={query.new === "1" || !sortedProjects.length ? true : undefined} className="rounded-xl border border-neutral-200 bg-white p-4">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"><Plus className="size-4" aria-hidden="true" />Добавить проект</summary>
          <div className="mt-4"><ProjectForm clients={[{ id: client.id, name: client.name }]} profiles={profiles ?? []} fixedClient={{ id: client.id, name: client.name }} /></div>
        </details>}
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
            {sortedProjects.length === 0 && <TableEmpty colSpan={5}>У клиента пока нет проектов. Нажмите «Добавить проект» и укажите название.</TableEmpty>}
            {sortedProjects.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="font-medium text-neutral-900">
                  <Link
                    href={`/projects/${project.id}`}
                    className="inline-flex max-w-64"
                  >
                    <ProjectBadge
                      projectId={project.id}
                      name={project.name}
                      logoUrl={project.logo_url}
                    />
                  </Link>
                </TableCell>
                <TableCell>
                  <ProjectQuickSelect projectId={project.id} projectName={project.name} field="health" value={project.health ?? "green"} />
                </TableCell>
                <TableCell>
                  <ProjectQuickSelect projectId={project.id} projectName={project.name} field="stage" value={project.stage ?? "active"} />
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
