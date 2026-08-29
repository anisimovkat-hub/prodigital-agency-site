"use client";

import { CalendarDays, Check, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateTaskDueDate } from "@/app/(dashboard)/tasks/actions";
import { Input } from "@/components/ui/input";
import { formatDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

type TaskDueDateCellProps = {
  taskId: string;
  taskTitle: string;
  dueDate: string | null;
  status: string | null;
};

export function TaskDueDateCell({
  taskId,
  taskTitle,
  dueDate,
  status,
}: TaskDueDateCellProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [savedDueDate, setSavedDueDate] = useState(dueDate);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cancelEditing() {
    setMessage(null);
    setEditing(false);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const dueDateValue = new FormData(event.currentTarget).get("due_date");
    const nextDueDate =
      typeof dueDateValue === "string" ? dueDateValue : "";

    startTransition(async () => {
      const result = await updateTaskDueDate(taskId, nextDueDate);
      if (!result.success) {
        setMessage(result.error);
        return;
      }

      setSavedDueDate(result.dueDate);
      setMessage("Сохранено");
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="min-w-32">
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setEditing(true);
          }}
          className={cn(
            "group inline-flex min-h-9 w-full items-center gap-1.5 rounded-md px-2 text-left text-sm transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
            isOverdue(savedDueDate, status)
              ? "font-medium text-red-600"
              : "text-neutral-700",
          )}
          aria-label={`Изменить дедлайн задачи «${taskTitle}»`}
          title="Нажмите, чтобы изменить дедлайн"
        >
          <CalendarDays className="size-3.5 shrink-0 text-neutral-400" />
          <span>{formatDate(savedDueDate)}</span>
          <Pencil className="ml-auto size-3 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </button>
        <p
          aria-live="polite"
          className={
            message === "Сохранено"
              ? "mt-0.5 px-2 text-xs text-emerald-700"
              : "sr-only"
          }
        >
          {message}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="grid min-w-48 gap-1"
      onKeyDown={(event) => {
        if (event.key === "Escape") cancelEditing();
      }}
    >
      <div className="flex items-center gap-1">
        <Input
          name="due_date"
          type="date"
          defaultValue={savedDueDate ?? ""}
          disabled={pending}
          autoFocus
          aria-label={`Дедлайн задачи «${taskTitle}»`}
          className="min-w-36"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Сохранить дедлайн"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={cancelEditing}
          disabled={pending}
          aria-label="Отменить изменение дедлайна"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 disabled:opacity-50"
        >
          <X className="size-4" />
        </button>
      </div>
      {message && message !== "Сохранено" && (
        <p className="text-xs text-red-600" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
