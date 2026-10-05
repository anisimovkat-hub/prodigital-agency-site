"use client";

import { useActionState, useState } from "react";
import { CircleAlert, CircleCheck, Plus, RefreshCw } from "lucide-react";

import {
  connectAdAccount,
  disconnectAdAccount,
  syncProjectAdAccounts,
  type AdAccountState,
} from "@/app/(dashboard)/projects/[id]/ad-account-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AD_PLATFORMS } from "@/lib/ad-platforms";

export type ProjectAdAccount = {
  id: string;
  platform: string;
  name: string | null;
  currency: string | null;
  usesKey: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
};

const PLATFORM_LABEL = Object.fromEntries(AD_PLATFORMS.map((platform) => [platform.value, platform.label]));

function Status({ state }: { state: AdAccountState }) {
  if (!state) return null;
  return <p role="status" className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</p>;
}

function syncedAt(value: string) {
  const date = new Date(value);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function DisconnectButton({ projectId, accountId }: { projectId: string; accountId: string }) {
  const [state, action, pending] = useActionState<AdAccountState, FormData>(disconnectAdAccount, undefined);
  return <form action={action} onSubmit={(event) => { if (!confirm("Отключить кабинет? Ключ будет удалён, прошлая статистика останется.")) event.preventDefault(); }}>
    <input type="hidden" name="project_id" value={projectId} />
    <input type="hidden" name="account_id" value={accountId} />
    <button type="submit" disabled={pending} className="text-xs text-neutral-400 hover:text-red-600">{pending ? "Отключаю…" : "Отключить"}</button>
    {state && !state.ok && <Status state={state} />}
  </form>;
}

export function AdAccountsSection({ projectId, isOwner, accounts, unlinkedMeta }: {
  projectId: string;
  isOwner: boolean;
  accounts: ProjectAdAccount[];
  unlinkedMeta: { id: string; name: string }[];
}) {
  const [adding, setAdding] = useState(accounts.length === 0);
  const [platform, setPlatform] = useState("");
  const [connectState, connect, connecting] = useActionState<AdAccountState, FormData>(connectAdAccount, undefined);
  const [syncState, sync, syncing] = useActionState<AdAccountState, FormData>(syncProjectAdAccounts, undefined);
  const config = AD_PLATFORMS.find((item) => item.value === platform);
  const choices = AD_PLATFORMS.filter((item) => item.value !== "meta" || isOwner);

  return <section className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold text-neutral-900">Рекламные кабинеты</h2>
      <div className="flex gap-2">
        {accounts.some((account) => account.usesKey) && <form action={sync}>
          <input type="hidden" name="project_id" value={projectId} />
          <Button type="submit" variant="outline" size="sm" disabled={syncing}><RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Обновляю…" : "Обновить статистику"}</Button>
        </form>}
        {!adding && <Button type="button" size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5" />Подключить кабинет</Button>}
      </div>
    </div>
    <Status state={syncState} />

    {accounts.length > 0 && <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
      {accounts.map((account) => <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900">{account.name ?? "Без названия"}</p>
          <p className="text-xs text-neutral-500">{PLATFORM_LABEL[account.platform] ?? account.platform}{account.currency ? ` · ${account.currency}` : ""}</p>
        </div>
        <div className="flex items-center gap-4">
          {account.lastError
            ? <span className="flex max-w-md items-center gap-1 text-xs text-red-600" title={account.lastError}><CircleAlert className="size-3.5 shrink-0" /><span className="truncate">{account.lastError}</span></span>
            : <span className="flex items-center gap-1 text-xs text-emerald-700"><CircleCheck className="size-3.5" />{account.lastSyncAt ? `обновлено ${syncedAt(account.lastSyncAt)}` : account.usesKey ? "ждёт первой загрузки" : "общий доступ агентства"}</span>}
          {account.usesKey && <DisconnectButton projectId={projectId} accountId={account.id} />}
        </div>
      </li>)}
    </ul>}

    {adding && <form action={connect} className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4" autoComplete="off">
      <input type="hidden" name="project_id" value={projectId} />
      <label className="flex max-w-sm flex-col gap-1 text-xs font-medium text-neutral-600">Площадка
        <Select name="platform" value={platform} onChange={(event) => setPlatform(event.target.value)} required>
          <option value="">Выберите площадку</option>
          {choices.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
      </label>
      {config && <>
        <ul className="space-y-1 text-xs leading-relaxed text-neutral-500">{config.help.map((line) => <li key={line}>{line}</li>)}</ul>
        {config.link && <a href={config.link.href} target="_blank" rel="noopener noreferrer" className="inline-flex text-xs font-medium text-blue-600 hover:underline">{config.link.label} ↗</a>}
        {config.value === "meta"
          ? unlinkedMeta.length
            ? <label className="flex max-w-sm flex-col gap-1 text-xs font-medium text-neutral-600">Кабинет Meta
                <Select name="meta_account_id" required defaultValue=""><option value="" disabled>Выберите кабинет</option>{unlinkedMeta.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select>
              </label>
            : <p className="text-xs text-amber-700">Свободных кабинетов Meta нет: все найденные уже привязаны к проектам.</p>
          : <div className="grid gap-3 sm:grid-cols-2">{config.fields.map((field) => <label key={field.name} className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
              {field.label}{field.optional ? " (необязательно)" : ""}
              <Input name={field.name} type={field.secret ? "password" : "text"} required={!field.optional} placeholder={field.placeholder} autoComplete={field.secret ? "new-password" : "off"} spellCheck={false} />
            </label>)}</div>}
        <p className="text-[11px] text-neutral-400">Ключ проверяется запросом к площадке и хранится в зашифрованном хранилище. Agency OS только читает статистику и ничего не меняет в рекламе.</p>
      </>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={connecting || !platform}>{connecting ? "Проверяю и загружаю…" : "Подключить"}</Button>
        {accounts.length > 0 && <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Отмена</Button>}
      </div>
      <Status state={connectState} />
    </form>}
  </section>;
}
