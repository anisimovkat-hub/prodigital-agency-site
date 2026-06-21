import * as React from "react";

import { cn } from "@/lib/utils";

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
