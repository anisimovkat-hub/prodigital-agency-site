"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateTaskQuickField } from "@/app/(dashboard)/tasks/actions";
import { TASK_PRIORITY_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type AssigneeOption = { id: string; name: string };

type TaskQuickSelectProps =
  | {
      taskId: string;
      taskTitle: string;
      field: "priority";
      value: Enums<"task_priority"> | null;
      options?: never;
      compact?: boolean;
      className?: string;
    }
  | {
      taskId: string;
      taskTitle: string;
      field: "assignee_id";
      value: string | null;
      options: AssigneeOption[];
      compact?: boolean;
      className?: string;
    };

export function TaskQuickSelect(props: TaskQuickSelectProps) {
  const router = useRouter();
  const [savedValue, setSavedValue] = useState(props.value ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = props.field === "priority" ? "приоритет" : "исполнителя";

  function changeValue(nextValue: string) {
    const previousValue = savedValue;
    setSavedValue(nextValue);
    setMessage(null);

    startTransition(async () => {
      const result = await updateTaskQuickField(
        props.taskId,
        props.field,
        nextValue,
      );
      if (!result.success) {
        setSavedValue(previousValue);
        setMessage(result.error);
        return;
      }

      setSavedValue(result.value ?? "");
      setMessage("Сохранено");
      router.refresh();
    });
  }

  const priority =
    props.field === "priority"
      ? ((savedValue || "medium") as Enums<"task_priority">)
      : null;

  return (
    <div
      className={cn("relative z-20 min-w-0", props.className)}
      draggable={false}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <select
        aria-label={`Изменить ${label} задачи «${props.taskTitle}»`}
        title={`Изменить ${label}`}
        value={savedValue}
        disabled={pending}
        onChange={(event) => changeValue(event.target.value)}
        className={cn(
          "max-w-full cursor-pointer rounded-full border px-2.5 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-wait disabled:opacity-60",
          props.compact ? "h-7" : "h-9",
          props.field === "assignee_id" &&
            "border-neutral-200 bg-neutral-100 text-neutral-700",
          priority === "urgent" && "border-red-200 bg-red-50 text-red-700",
          priority === "high" &&
            "border-amber-200 bg-amber-50 text-amber-700",
          priority === "medium" &&
            "border-blue-100 bg-blue-50 text-blue-700",
          priority === "low" &&
            "border-neutral-200 bg-neutral-100 text-neutral-600",
        )}
      >
        {props.field === "priority" ? (
          Object.entries(TASK_PRIORITY_LABEL).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))
        ) : (
          <>
            <option value="">Не назначен</option>
            {props.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </>
        )}
      </select>
      <span
        aria-live="polite"
        className={cn(
          "absolute left-0 top-full mt-0.5 whitespace-nowrap text-[10px]",
          message === "Сохранено" ? "text-emerald-700" : "text-red-600",
          !message && "sr-only",
        )}
      >
        {message}
      </span>
    </div>
  );
}
