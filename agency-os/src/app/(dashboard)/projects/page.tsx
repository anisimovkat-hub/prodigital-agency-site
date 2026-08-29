import { ProjectForm } from "@/app/(dashboard)/projects/project-form";
import {
  ProjectsTable,
  type ProjectListRow,
} from "@/app/(dashboard)/projects/projects-table";
import { sortProjectsForDisplay } from "@/lib/project-order";
import { createClient } from "@/lib/supabase/server";
import {
  allocateTaskTime,
  type TaskTimeEntry,
} from "@/lib/time-analytics";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const now = new Date();

  const monthStart = new Date(now);
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [
    { data: projects },
    { data: clients },
    { data: profiles },
    { data: timeRows },
    { data: projectResponsibles },
  ] =
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
      supabase
        .from("project_responsibles")
        .select("project_id,sort_order,profile:profiles(id,full_name)")
        .order("sort_order"),
    ]);

  const responsiblesByProject = new Map<
    string,
    { id: string; full_name: string }[]
  >();
  for (const projectResponsible of projectResponsibles ?? []) {
    if (!projectResponsible.profile) continue;
    const responsibles = responsiblesByProject.get(projectResponsible.project_id) ?? [];
    responsibles.push(projectResponsible.profile);
    responsiblesByProject.set(projectResponsible.project_id, responsibles);
  }

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
  const currentProjects = sortProjectsForDisplay(
    (projects ?? []).filter((project) => project.stage !== "finished"),
  );
  const finishedProjects = (projects ?? []).filter(
    (project) => project.stage === "finished",
  );

  const projectRows = (rows: typeof currentProjects): ProjectListRow[] =>
    rows.map((project) => ({
      id: project.id,
      name: project.name,
      logo_url: project.logo_url,
      client: project.client,
      health: project.health,
      stage: project.stage,
      monthly_fee: project.monthly_fee,
      budget: project.budget,
      monthlyHours: hoursByProject.get(project.id) ?? 0,
      responsibles:
        responsiblesByProject.get(project.id) ??
        (project.responsible ? [project.responsible] : []),
    }));
  const profileOptions = (profiles ?? []).map((profile) => ({
    id: profile.id,
    full_name: profile.full_name,
  }));

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

      <ProjectsTable
        rows={projectRows(currentProjects)}
        profiles={profileOptions}
        storageKey="agency-os:projects-column-order"
      />

      {finishedProjects.length > 0 && (
        <details className="group rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-700">
            Завершённые проекты ({finishedProjects.length})
          </summary>
          <div className="mt-4">
            <ProjectsTable
              rows={projectRows(finishedProjects)}
              profiles={profileOptions}
              storageKey="agency-os:projects-column-order"
            />
          </div>
        </details>
      )}
    </div>
  );
}
