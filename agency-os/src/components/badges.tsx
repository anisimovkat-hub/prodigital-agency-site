import { Badge } from "@/components/ui/badge";
import {
  CLIENT_STATUS_LABEL,
  PROJECT_HEALTH_LABEL,
  PROJECT_STAGE_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_TYPE_LABEL,
} from "@/lib/labels";
import type { Enums } from "@/lib/supabase/types";

export function HealthBadge({ health }: { health: Enums<"project_health"> }) {
  const variant =
    health === "green" ? "green" : health === "yellow" ? "yellow" : "red";
  return (
    <Badge variant={variant} dot>
      {PROJECT_HEALTH_LABEL[health]}
    </Badge>
  );
}

export function ProjectStageBadge({
  stage,
}: {
  stage: Enums<"project_stage">;
}) {
  const variant =
    stage === "active"
      ? "green"
      : stage === "launching"
        ? "blue"
        : stage === "paused"
          ? "yellow"
          : "neutral";
  return (
    <Badge variant={variant} dot>
      {PROJECT_STAGE_LABEL[stage]}
    </Badge>
  );
}

export function ClientStatusBadge({
  status,
}: {
  status: Enums<"client_status">;
}) {
  const variant =
    status === "active" ? "green" : status === "paused" ? "yellow" : "red";
  return (
    <Badge variant={variant} dot>
      {CLIENT_STATUS_LABEL[status]}
    </Badge>
  );
}

export function TaskStatusBadge({ status }: { status: Enums<"task_status"> }) {
  const variant =
    status === "done"
      ? "green"
      : status === "cancelled"
        ? "red"
        : status === "ai_wait"
          ? "violet"
          : status === "in_progress"
            ? "blue"
            : status === "review"
              ? "yellow"
              : "neutral";
  return (
    <Badge variant={variant} dot>
      {TASK_STATUS_LABEL[status]}
    </Badge>
  );
}

export function PriorityBadge({
  priority,
}: {
  priority: Enums<"task_priority">;
}) {
  const variant =
    priority === "urgent" ? "red" : priority === "high" ? "yellow" : "neutral";
  return (
    <Badge variant={variant} dot>
      {TASK_PRIORITY_LABEL[priority]}
    </Badge>
  );
}

export function TaskTypeBadge({ type }: { type: Enums<"task_type"> }) {
  return <Badge variant="neutral">{TASK_TYPE_LABEL[type]}</Badge>;
}

export function OverdueBadge() {
  return (
    <Badge variant="red" dot>
      Просрочено
    </Badge>
  );
}
