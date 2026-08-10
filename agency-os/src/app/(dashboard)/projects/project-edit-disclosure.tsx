"use client";

import { Pencil, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function ProjectEditDisclosure({
  children,
  editor,
}: {
  children: ReactNode;
  editor: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {children}
        <Button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="project-editor"
          className="shrink-0"
        >
          {open ? (
            <X aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Pencil aria-hidden="true" className="h-4 w-4" />
          )}
          {open ? "Закрыть редактор" : "Редактировать проект"}
        </Button>
      </div>

      {open && (
        <div
          id="project-editor"
          className="rounded-lg border border-neutral-200 bg-white p-4"
        >
          {editor}
        </div>
      )}
    </div>
  );
}
