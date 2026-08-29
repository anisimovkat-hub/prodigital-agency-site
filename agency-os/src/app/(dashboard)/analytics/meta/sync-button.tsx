"use client";

import { useActionState } from "react";

import {
  syncMetaAdDetails,
  syncMetaAds,
  type SyncMetaState,
} from "@/app/(dashboard)/analytics/meta/actions";
import { Button } from "@/components/ui/button";

type SyncMetaButtonProps = {
  projectId: string;
};

const LOAD_PERIODS = [
  { value: "7", label: "7 дней" },
  { value: "14", label: "14 дней" },
  { value: "30", label: "30 дней" },
  { value: "90", label: "90 дней" },
  { value: "180", label: "180 дней" },
  { value: "365", label: "год" },
];

function ProjectField({ projectId }: SyncMetaButtonProps) {
  return <>
    <input type="hidden" name="project_id" value={projectId} />
  </>;
}

function LoadPeriodSelect({ disabled }: { disabled: boolean }) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-neutral-500">
      Загрузить за
      <select
        name="days"
        defaultValue="30"
        disabled={disabled}
        aria-label="Период загрузки Meta"
        className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm font-normal text-neutral-700"
      >
        {LOAD_PERIODS.map((period) => (
          <option key={period.value} value={period.value}>{period.label}</option>
        ))}
      </select>
    </label>
  );
}

export function SyncMetaButton({ projectId }: SyncMetaButtonProps) {
  const [state, formAction, pending] = useActionState<SyncMetaState, FormData>(
    syncMetaAds,
    undefined,
  );

  return (
    <form action={formAction} className="flex w-full flex-wrap items-center justify-end gap-2">
      <ProjectField projectId={projectId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Обновляю кампании…" : "Обновить кампании Meta"}
      </Button>
      <LoadPeriodSelect disabled={pending} />
      {state && (
        <span
          className={
            state.ok
              ? "basis-full text-right text-sm font-medium leading-relaxed text-emerald-700"
              : "basis-full text-right text-sm font-medium leading-relaxed text-red-600"
          }
        >
          {state.message}
        </span>
      )}
    </form>
  );
}

// Детальная загрузка групп объявлений и объявлений (level=adset/ad). Тяжёлая,
// поэтому отдельной кнопкой — не блокирует быстрый основной синк.
export function SyncMetaDetailsButton({ projectId }: SyncMetaButtonProps) {
  const [state, formAction, pending] = useActionState<SyncMetaState, FormData>(
    syncMetaAdDetails,
    undefined,
  );

  return (
    <form action={formAction} className="flex w-full flex-wrap items-center justify-end gap-2">
      <ProjectField projectId={projectId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Загружаю детали…" : "Загрузить группы и объявления"}
      </Button>
      <LoadPeriodSelect disabled={pending} />
      {state && (
        <span
          className={
            state.ok
              ? "basis-full text-right text-sm font-medium leading-relaxed text-emerald-700"
              : "basis-full text-right text-sm font-medium leading-relaxed text-red-600"
          }
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
