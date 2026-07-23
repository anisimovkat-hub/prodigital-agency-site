import { projectBadgeColors } from "@/lib/project-colors";
import { cn } from "@/lib/utils";

export function ProjectBadge({
  projectId,
  name,
  className,
}: {
  projectId: string | null | undefined;
  name: string | null | undefined;
  className?: string;
}) {
  if (!projectId || !name) {
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600",
          className,
        )}
      >
        <span className="truncate">Личное</span>
      </span>
    );
  }

  return (
    <span
      title={name}
      style={projectBadgeColors(projectId)}
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
    >
      <span className="truncate">{name}</span>
    </span>
  );
}
