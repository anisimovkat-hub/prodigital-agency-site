"use client";

import { useActionState } from "react";

import { syncMetaAds, type SyncMetaState } from "@/app/(dashboard)/ads/actions";
import { Button } from "@/components/ui/button";

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
