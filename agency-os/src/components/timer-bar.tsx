"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

import { startTimer, stopTimer } from "@/app/(dashboard)/timer-actions";
import { cn } from "@/lib/utils";

type ActiveEntry = {
  id: string;
  project_id: string | null;
  started_at: string;
  project: { id: string; name: string } | null;
} | null;

export function TimerBar({
  active,
  projects,
}: {
  active: ActiveEntry;
  projects: { id: string; name: string }[];
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  let elapsed = "00:00:00";
  if (active) {
    const total = Math.max(
      0,
      Math.floor((now - new Date(active.started_at).getTime()) / 1000),
    );
    const hh = String(Math.floor(total / 3600)).padStart(2, "0");
    const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const ss = String(total % 60).padStart(2, "0");
    elapsed = `${hh}:${mm}:${ss}`;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2 text-sm",
        active
          ? "border-emerald-200 bg-emerald-50"
          : "border-neutral-200 bg-white",
      )}
    >
      {active ? (
        <span className="flex items-center gap-2 font-medium text-emerald-800">
          <Play className="size-4 fill-emerald-600 text-emerald-600" aria-hidden />
          {active.project?.name ?? "Без проекта"}
          <span className="font-mono tabular-nums text-emerald-700">
            {elapsed}
          </span>
        </span>
      ) : (
        <span className="text-neutral-500">Таймер выключен</span>
      )}

      <form action={startTimer} className="ml-auto">
        <select
          name="project_id"
          defaultValue=""
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-800"
        >
          <option value="" disabled hidden>
            {active ? "Переключить на…" : "Начать работу над…"}
          </option>
          <option value="none">Без проекта / личное</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </form>

      {active && (
        <form action={stopTimer}>
          <button
            type="submit"
            className="flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 py-1 font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Pause className="size-3.5" aria-hidden />
            Стоп
          </button>
        </form>
      )}
    </div>
  );
}
