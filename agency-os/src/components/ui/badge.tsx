import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-neutral-100 text-neutral-700",
        green: "bg-emerald-100 text-emerald-800",
        yellow: "bg-amber-100 text-amber-800",
        red: "bg-red-100 text-red-800",
        blue: "bg-blue-100 text-blue-800",
        violet: "bg-violet-100 text-violet-800",
        sky: "bg-sky-100 text-sky-800",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

/** `dot` добавляет цветную точку: статус читается не только по цвету фона. */
function Badge({
  className,
  variant,
  dot = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    >
      {dot && (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
