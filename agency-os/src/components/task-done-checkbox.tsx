"use client";

import { useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { toggleTaskDone } from "@/app/(dashboard)/tasks/actions";

export function TaskDoneCheckbox({
  taskId,
  done,
}: {
  taskId: string;
  done: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Checkbox
      defaultChecked={done}
      disabled={isPending}
      onChange={(e) => {
        const checked = e.target.checked;
        startTransition(() => {
          toggleTaskDone(taskId, checked);
        });
      }}
    />
  );
}
