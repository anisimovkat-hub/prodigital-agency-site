"use client";

import { Bot, CircleStop, Focus, Play } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import {
  startTaskFocus,
  stopTaskFocus,
  waitForAi,
} from "@/app/(dashboard)/focus-actions";
import { formatTimerDuration } from "@/lib/format";

type FocusTask = {
  id: string;
  title: string;
  project: { id: string; name: string } | null;
};

export function FocusBar({
  active,
  tasks,
}: {
  active: { id: string; started_at: string; task: FocusTask | null } | null;
  tasks: FocusTask[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [switchTarget, setSwitchTarget] = useState<FocusTask | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [active]);

  const elapsed = active
    ? Math.max(0, Math.floor((now - new Date(active.started_at).getTime()) / 1_000))
    : 0;

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.success) setError(result.error ?? "Не удалось изменить фокус");
      else setSwitchTarget(null);
    });
  }

  function selectTask(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (active?.task && active.task.id !== task.id) {
      setSwitchTarget(task);
      return;
    }
    run(() => startTaskFocus(task.id));
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {active?.task ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 text-emerald-800">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <Focus className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{active.task.title}</span>
              <span className="block truncate text-[11px] text-emerald-700">
                {active.task.project?.name ?? "Личное"} · точный фокус
              </span>
            </span>
            <span className="ml-auto shrink-0 font-mono font-semibold tabular-nums">
              {formatTimerDuration(elapsed)}
            </span>
          </div>
        ) : (
          <span className="flex flex-1 items-center gap-2 text-neutral-500">
            <Focus className="size-4" aria-hidden />
            Сейчас нет активного фокуса
          </span>
        )}

        <select
          aria-label="Выбрать задачу для фокуса"
          defaultValue=""
          disabled={pending}
          onChange={(event) => {
            const taskId = event.currentTarget.value;
            if (taskId) selectTask(taskId);
            event.currentTarget.value = "";
          }}
          className="min-h-9 max-w-72 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-800"
        >
          <option value="" disabled hidden>
            {active ? "Переключить фокус…" : "Начать фокус…"}
          </option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>

        {active?.task && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => waitForAi(active.task!.id))}
              className="inline-flex min-h-9 items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-2.5 font-medium text-cyan-800 hover:bg-cyan-100"
            >
              <Bot className="size-3.5" aria-hidden />
              Жду ИИ
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(stopTaskFocus)}
              className="inline-flex min-h-9 items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <CircleStop className="size-3.5" aria-hidden />
              Стоп
            </button>
          </>
        )}
        {!active && <Play className="hidden size-4 text-neutral-400 sm:block" aria-hidden />}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      {switchTarget && active?.task && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <span className="min-w-0 flex-1">
            Переключить фокус с «{active.task.title}» на «{switchTarget.title}»?
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => startTaskFocus(switchTarget.id))}
            className="rounded-md bg-amber-900 px-2.5 py-1.5 font-semibold text-white hover:bg-amber-800"
          >
            Переключить
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setSwitchTarget(null)}
            className="rounded-md px-2.5 py-1.5 font-medium text-amber-900 hover:bg-amber-100"
          >
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}
