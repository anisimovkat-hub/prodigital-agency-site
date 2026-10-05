"use client";

import { useActionState } from "react";
import { FaYandex } from "react-icons/fa";

import {
  linkYandexAccount,
  syncYandexProject,
  type YandexProjectState,
} from "@/app/(dashboard)/analytics/yandex-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function Status({ state }: { state: YandexProjectState }) {
  if (!state) return null;
  return <p role="status" className={`w-full text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>;
}

/** Owner-only: link a Yandex Direct login to the project and import statistics read-only. */
export function YandexProjectPanel({ projectId, period, accounts }: {
  projectId: string;
  period: { from: string; to: string };
  accounts: { login: string; name: string | null; currency: string | null }[];
}) {
  const [linkState, linkAction, linking] = useActionState<YandexProjectState, FormData>(linkYandexAccount, undefined);
  const [syncState, syncAction, syncing] = useActionState<YandexProjectState, FormData>(syncYandexProject, undefined);

  return <details className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
    <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-700">
      <FaYandex className="size-4 text-[#fc3f1d]" aria-hidden="true" />Яндекс.Директ{accounts.length ? ` · ${accounts.map((account) => account.name ?? account.login).join(", ")}` : " · не подключён"}
    </summary>
    <div className="mt-3 space-y-4 border-t border-neutral-100 pt-3">
      {accounts.length > 0 && <form action={syncAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="from" value={period.from} />
        <input type="hidden" name="to" value={period.to} />
        <Button type="submit" disabled={syncing}>{syncing ? "Загружаю отчёт Яндекса…" : "Загрузить статистику за выбранный период"}</Button>
        <span className="text-xs text-neutral-400">Только чтение · расход без НДС · ежедневно обновляется автоматически</span>
        <Status state={syncState} />
      </form>}
      <form action={linkAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="project_id" value={projectId} />
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs text-neutral-500">Логин кабинета клиента в Директе
          <Input name="login" required placeholder="например, client-login" autoComplete="off" />
        </label>
        <Button type="submit" variant="outline" disabled={linking}>{linking ? "Проверяю доступ…" : "Подключить кабинет"}</Button>
        <p className="w-full text-xs text-neutral-400">Клиент добавляет ваш логин представителем с правом просмотра в «Представители» своего кабинета. Agency OS проверит доступ и ничего не изменит в рекламе.</p>
        <Status state={linkState} />
      </form>
    </div>
  </details>;
}
