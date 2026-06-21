import * as React from "react";

import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-neutral-50", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("divide-y divide-neutral-100", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("transition-colors hover:bg-neutral-50", className)}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-9 whitespace-nowrap px-3 text-left align-middle text-xs font-medium text-neutral-500",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-3 py-2.5 align-middle text-neutral-800", className)}
      {...props}
    />
  );
}

function TableEmpty({
  colSpan,
  children = "Пока пусто.",
}: {
  colSpan: number;
  children?: React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="py-8 text-center text-sm text-neutral-400"
      >
        {children}
      </TableCell>
    </TableRow>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
};
