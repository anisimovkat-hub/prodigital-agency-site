type ProjectStage = "active" | "launching" | "paused" | "finished";

type ProjectSummary = {
  id: string;
  responsible_id: string | null;
  stage: ProjectStage | null;
};

type ProjectMemberSummary = {
  profile_id: string;
  project_id: string;
  project: { stage: ProjectStage | null } | null;
};

const ACTIVE_PROJECT_STAGES = new Set<ProjectStage>(["active", "launching"]);

export function activeProjectIdsByEmployee(
  projects: ProjectSummary[],
  members: ProjectMemberSummary[],
) {
  const projectIdsByEmployee = new Map<string, Set<string>>();

  for (const project of projects) {
    if (
      !project.responsible_id ||
      !project.stage ||
      !ACTIVE_PROJECT_STAGES.has(project.stage)
    ) {
      continue;
    }
    const projectIds =
      projectIdsByEmployee.get(project.responsible_id) ?? new Set<string>();
    projectIds.add(project.id);
    projectIdsByEmployee.set(project.responsible_id, projectIds);
  }

  for (const member of members) {
    if (
      !member.project?.stage ||
      !ACTIVE_PROJECT_STAGES.has(member.project.stage)
    ) {
      continue;
    }
    const projectIds =
      projectIdsByEmployee.get(member.profile_id) ?? new Set<string>();
    projectIds.add(member.project_id);
    projectIdsByEmployee.set(member.profile_id, projectIds);
  }

  return projectIdsByEmployee;
}
