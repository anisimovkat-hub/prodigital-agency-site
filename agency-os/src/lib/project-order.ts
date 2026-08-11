import type { Enums } from "@/lib/supabase/types";

type ProjectForDisplay = {
  name: string;
  stage: Enums<"project_stage"> | null;
};

const STAGE_PRIORITY: Record<Enums<"project_stage">, number> = {
  launching: 0,
  active: 1,
  paused: 2,
  finished: 3,
};

/** Keeps launch projects visible and moves paused/finished work out of the way. */
export function sortProjectsForDisplay<T extends ProjectForDisplay>(
  projects: T[],
): T[] {
  return [...projects].sort((a, b) => {
    const priority =
      STAGE_PRIORITY[a.stage ?? "active"] - STAGE_PRIORITY[b.stage ?? "active"];
    if (priority !== 0) return priority;
    return a.name.localeCompare(b.name, "ru");
  });
}
