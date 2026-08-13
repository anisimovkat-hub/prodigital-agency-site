"use client";

import { Bot, CircleStop, Focus } from "lucide-react";
import { useState, useTransition } from "react";

import {
  startTaskFocus,
  stopTaskFocus,
  waitForAi,
} from "@/app/(dashboard)/focus-actions";

export function TaskFocusControls({
  taskId,
  focused,
  canFocus,
}: {
  taskId: string;
  focused: boolean;
  canFocus: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.success) setError(result.error ?? "Не удалось изменить фокус");
    });
  }

  if (!canFocus && !focused) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {focused ? (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => waitForAi(taskId))}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
          >
            <Bot className="size-3.5" aria-hidden />
            Жду ИИ
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(stopTaskFocus)}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <CircleStop className="size-3.5" aria-hidden />
            Стоп
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => startTaskFocus(taskId))}
          className="inline-flex min-h-8 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          <Focus className="size-3.5" aria-hidden />
          Сейчас работаю
        </button>
      )}
      {error && (
        <span role="alert" className="text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
