"use client";

import { useActionState } from "react";

import {
  syncMetaAdDetails,
  syncMetaAds,
  type SyncMetaState,
} from "@/app/(dashboard)/ads/actions";
import { Button } from "@/components/ui/button";

// Глубина догрузки истории; значения должны совпадать с ALLOWED_DAYS в actions.ts.
const DEPTHS = [
  { value: "30", label: "за 30 дней" },
  { value: "90", label: "за 90 дней" },
  { value: "180", label: "за 180 дней" },
  { value: "365", label: "за год" },
];

export function SyncMetaButton() {
  const [state, formAction, pending] = useActionState<SyncMetaState, FormData>(
    syncMetaAds,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Обновляю из Меты…" : "Обновить статистику Меты"}
      </Button>
      <select
        name="days"
        defaultValue="30"
        disabled={pending}
        aria-label="Глубина загрузки"
        className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-700"
      >
        {DEPTHS.map((depth) => (
          <option key={depth.value} value={depth.value}>
            {depth.label}
          </option>
        ))}
      </select>
      {state && (
        <span
          className={
            state.ok
              ? "text-sm font-medium text-emerald-700"
              : "text-sm font-medium text-red-600"
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
export function SyncMetaDetailsButton() {
  const [state, formAction, pending] = useActionState<SyncMetaState, FormData>(
    syncMetaAdDetails,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Загружаю детали…" : "Загрузить детали (группы и объявления)"}
      </Button>
      <select
        name="days"
        defaultValue="30"
        disabled={pending}
        aria-label="Глубина детальной загрузки"
        className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-700"
      >
        {DEPTHS.map((depth) => (
          <option key={depth.value} value={depth.value}>
            {depth.label}
          </option>
        ))}
      </select>
      {state && (
        <span
          className={
            state.ok
              ? "text-sm font-medium text-emerald-700"
              : "text-sm font-medium text-red-600"
          }
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
