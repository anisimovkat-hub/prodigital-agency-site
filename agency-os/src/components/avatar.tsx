import { cn } from "@/lib/utils";

export function Avatar({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const initials = getInitials(name);

  return (
    <span
      title={name || "Не назначен"}
      aria-label={name || "Не назначен"}
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-600",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function getInitials(name: string | null | undefined): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) return "?";

  const first = words[0][0];
  const last = words.length > 1 ? words.at(-1)![0] : "";
  return `${first}${last}`.toLocaleUpperCase("ru-RU");
}
