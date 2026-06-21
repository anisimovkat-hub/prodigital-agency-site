import * as React from "react";

import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 rounded border-neutral-300 text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-400",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
