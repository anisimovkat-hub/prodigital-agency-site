import { projectBadgeColors } from "@/lib/project-colors";
import { projectLogoUrl } from "@/lib/project-logos";
import { cn } from "@/lib/utils";

export function ProjectBadge({
  projectId,
  name,
  logoUrl,
  className,
}: {
  projectId: string | null | undefined;
  name: string | null | undefined;
  logoUrl?: string | null;
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

  const resolvedLogoUrl = projectLogoUrl(projectId, logoUrl);

  return (
    <span
      title={name}
      style={projectBadgeColors(projectId)}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
    >
      {resolvedLogoUrl && (
        <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded bg-white/90 p-px">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedLogoUrl}
            alt=""
            className="size-full object-contain"
          />
        </span>
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}
