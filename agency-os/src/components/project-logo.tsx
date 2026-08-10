import { projectBadgeColors } from "@/lib/project-colors";
import { projectLogoUrl } from "@/lib/project-logos";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  xs: "size-5 rounded-md text-[8px]",
  sm: "size-7 rounded-lg text-[10px]",
  md: "size-9 rounded-lg text-xs",
  lg: "size-11 rounded-xl text-sm",
} as const;

function initials(name: string | null | undefined): string {
  if (!name) return "OS";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "OS"
  );
}

export function ProjectLogo({
  projectId,
  name,
  logoUrl,
  size = "sm",
  className,
  decorative = false,
}: {
  projectId: string | null | undefined;
  name: string | null | undefined;
  logoUrl?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  decorative?: boolean;
}) {
  const resolvedLogoUrl = projectLogoUrl(projectId, logoUrl);
  const fallbackId = projectId ?? name ?? "personal";

  if (resolvedLogoUrl) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden border border-neutral-200 bg-white p-0.5",
          SIZE_CLASSES[size],
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedLogoUrl}
          alt={decorative ? "" : `Логотип проекта ${name ?? ""}`.trim()}
          className="size-full object-contain"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden={decorative || undefined}
      title={decorative ? undefined : name ?? "Проект"}
      style={projectBadgeColors(fallbackId)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center border font-bold",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
