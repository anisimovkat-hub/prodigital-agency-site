"use client";

import { useActionState } from "react";

import {
  discoverYandexAgencyClients,
  type YandexClientsState,
} from "@/app/(dashboard)/analytics/yandex-actions";
import { Button } from "@/components/ui/button";

export function YandexClientsPanel() {
  const [state, action, pending] = useActionState<YandexClientsState, FormData>(
    discoverYandexAgencyClients,
    undefined,
  );

  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-neutral-950">Яндекс.Директ — агентские кабинеты</h2>
          <p className="mt-1 max-w-2xl text-xs text-neutral-500">
            Только чтение: получаем список доступных кабинетов через AgencyClients.get. Кампании,
            ставки, бюджеты и историческая статистика не меняются и не загружаются на этом шаге.
          </p>
        </div>
        <form action={action}>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Проверяю доступ…" : "Проверить список кабинетов"}
          </Button>
        </form>
      </div>

      {state && (
        <p className={state.ok ? "mt-3 text-sm font-medium text-emerald-700" : "mt-3 text-sm font-medium text-red-600"}>
          {state.message}
        </p>
      )}

      {state?.ok && state.clients.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Логин</th>
                <th className="px-3 py-2 font-medium">Название</th>
                <th className="px-3 py-2 font-medium">Валюта</th>
                <th className="px-3 py-2 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {state.clients.map((client) => (
                <tr key={client.login} className="border-t border-neutral-100 text-neutral-700">
                  <td className="px-3 py-2 font-medium text-neutral-900">{client.login}</td>
                  <td className="px-3 py-2">{client.name ?? "—"}</td>
                  <td className="px-3 py-2">{client.currency ?? "—"}</td>
                  <td className="px-3 py-2">{client.archived ? "Архивный" : "Активный"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
