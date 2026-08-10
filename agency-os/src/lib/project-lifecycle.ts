import type { Enums } from "@/lib/supabase/types";

export function isCurrentProject(
  stage: Enums<"project_stage"> | null,
): boolean {
  return stage !== "finished";
}

export function clientStatusFromProjectStages(
  stages: Array<Enums<"project_stage"> | null>,
): Enums<"client_status"> {
  if (stages.some((stage) => stage === "active" || stage === null)) {
    return "active";
  }
  if (stages.some((stage) => stage === "paused")) {
    return "paused";
  }
  return "churned";
}
