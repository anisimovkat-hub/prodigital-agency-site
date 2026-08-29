"use client";

import { useActionState } from "react";

import {
  syncMetaAdDetails,
  syncMetaAds,
  type SyncMetaState,
} from "@/app/(dashboard)/analytics/meta/actions";
import { Button } from "@/components/ui/button";
import { formatAnalyticsPeriod, type AnalyticsPeriod } from "@/lib/analytics-period";

type SyncMetaButtonProps = {
  period: AnalyticsPeriod;
  projectId: string;
};

function PeriodFields({ period, projectId }: SyncMetaButtonProps) {
  return <>
    <input type="hidden" name="from" value={period.from} />
    <input type="hidden" name="to" value={period.to} />
    <input type="hidden" name="project_id" value={projectId} />
  </>;
}

export function SyncMetaButton({ period, projectId }: SyncMetaButtonProps) {
  const [state, formAction, pending] = useActionState<SyncMetaState, FormData>(
    syncMetaAds,
    undefined,
  );

  return (
    <form action={formAction} className="flex w-full flex-wrap items-center justify-end gap-2">
      <PeriodFields period={period} projectId={projectId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Обновляю кампании…" : "Обновить Meta за выбранный период"}
      </Button>
      <span className="text-xs text-neutral-500">{formatAnalyticsPeriod(period)}</span>
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
export function SyncMetaDetailsButton({ period, projectId }: SyncMetaButtonProps) {
  const [state, formAction, pending] = useActionState<SyncMetaState, FormData>(
    syncMetaAdDetails,
    undefined,
  );

  return (
    <form action={formAction} className="flex w-full flex-wrap items-center justify-end gap-2">
      <PeriodFields period={period} projectId={projectId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Загружаю детали…" : "Загрузить детали за этот период"}
      </Button>
      <span className="text-xs text-neutral-500">{formatAnalyticsPeriod(period)}</span>
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
