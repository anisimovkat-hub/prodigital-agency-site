"use client";

import { useActionState } from "react";

import { syncManifestAnalytics } from "@/app/(dashboard)/analytics/actions";

export function ManifestSyncButton() {
  const [state, action, pending] = useActionState(syncManifestAnalytics, undefined);
  return <form action={action} className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm">
    <span className="text-neutral-600">ВК и Telegram: автоматическое обновление каждый день из таблицы «ПРИН и СОДА».</span>
    <button type="submit" disabled={pending} className="rounded-md border border-neutral-300 px-3 py-1.5 font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50">
      {pending ? "Обновляю…" : "Обновить сейчас"}
    </button>
    {state && <span role="status" className={state.ok ? "text-green-700" : "text-red-700"}>{state.message}</span>}
  </form>;
}
