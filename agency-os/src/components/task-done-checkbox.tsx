"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Checkbox } from "@/components/ui/checkbox";
import { toggleTaskDone } from "@/app/(dashboard)/tasks/actions";

export function TaskDoneCheckbox({
  taskId,
  done,
  label = done ? "Вернуть задачу в активные" : "Отметить задачу выполненной",
}: {
  taskId: string;
  done: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = useOptimistic(done);
  const [isPending, startTransition] = useTransition();

  return (
    <Checkbox
      aria-label={label}
      title={label}
      checked={checked}
      disabled={isPending}
      onChange={(e) => {
        const nextChecked = e.target.checked;
        startTransition(async () => {
          setChecked(nextChecked);
          const result = await toggleTaskDone(taskId, nextChecked);
          if (result.success) router.refresh();
        });
      }}
      className="h-5 w-5 cursor-pointer disabled:cursor-wait"
    />
  );
}
