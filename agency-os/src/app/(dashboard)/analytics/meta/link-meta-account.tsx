"use client";

import { useActionState } from "react";

import { linkMetaAccount, type SyncMetaState } from "@/app/(dashboard)/analytics/meta/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function LinkMetaAccount({ projectId, accounts }: { projectId: string; accounts: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<SyncMetaState, FormData>(linkMetaAccount, undefined);
  if (!accounts.length) return null;
  return <form action={action} className="flex flex-wrap items-end gap-2">
    <input type="hidden" name="project_id" value={projectId} />
    <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs text-neutral-500">Кабинет без проекта
      <Select name="account_id" required defaultValue="">
        <option value="" disabled>Выберите кабинет</option>
        {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
      </Select>
    </label>
    <Button type="submit" disabled={pending}>{pending ? "Подключаем…" : "Подключить кабинет"}</Button>
    {state?.message && <p role="status" className={`w-full text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
  </form>;
}
