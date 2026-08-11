import type { Enums } from "@/lib/supabase/types";

export function isCurrentProject(
  stage: Enums<"project_stage"> | null,
): boolean {
  return stage !== "finished";
}

/** A project whose tasks should participate in day-to-day operational views. */
export function isOperationalProject(
  stage: Enums<"project_stage"> | null,
): boolean {
  return stage === "launching" || stage === "active" || stage === null;
}

type TaskWithProjectStage = {
  project_id: string | null;
  project: { stage: Enums<"project_stage"> | null } | null;
};

/** Personal tasks stay visible; project tasks pause together with their project. */
export function isTaskOperational(task: TaskWithProjectStage): boolean {
  if (!task.project_id) return true;
  return task.project ? isOperationalProject(task.project.stage) : false;
}

export function clientStatusFromProjectStages(
  stages: Array<Enums<"project_stage"> | null>,
): Enums<"client_status"> {
  if (
    stages.some(
      (stage) => stage === "active" || stage === "launching" || stage === null,
    )
  ) {
    return "active";
  }
  if (stages.some((stage) => stage === "paused")) {
    return "paused";
  }
  return "churned";
}
