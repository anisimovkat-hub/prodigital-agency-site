"use client";

import { useActionState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { saveGoalSettings, type GoalSettingsState } from "@/app/(dashboard)/analytics/meta/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type GoalSettingOption = { key: string; defaultLabel: string; label: string | null; hidden: boolean; extra: boolean; isMain: boolean; isPrimary?: boolean };

/** Optional fine-tuning: goals are detected automatically; here they can be renamed, hidden or added. */
export function GoalSettingsForm({ projectId, goals }: { projectId: string; goals: GoalSettingOption[] }) {
  const [state, action, pending] = useActionState<GoalSettingsState, FormData>(saveGoalSettings, undefined);
  if (!goals.length) return null;
  return <details className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
    <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-700"><SlidersHorizontal className="size-4" />Цели проекта</summary>
    <form action={action} className="mt-3 space-y-3 border-t border-neutral-100 pt-3">
      <input type="hidden" name="project_id" value={projectId} />
      <p className="text-xs leading-relaxed text-neutral-500">Для Яндекса выберите основную конкретную цель. Клики и автоцели не складываются с заявками. Модель атрибуции: последний переход (LC); считаются целевые визиты, не уникальные люди. Основная цель запоминается для проекта. Для каждого направления можно назначить свою.</p>
      <label className="flex gap-2 text-xs text-neutral-600"><input type="radio" name="primary_goal" value="" defaultChecked={!goals.some((g) => g.isPrimary)} />Без основной цели</label>
      <ul className="divide-y divide-neutral-100">
        {goals.map((goal) => <li key={goal.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 py-2 sm:grid-cols-[minmax(0,2fr)_auto_minmax(0,1fr)_auto_auto]">
          <input type="hidden" name="goal_key" value={goal.key} />
          <span className="min-w-0 text-sm text-neutral-800">{goal.defaultLabel}<span className="ml-1.5 text-[11px] text-neutral-400">{goal.isMain ? "цель кампаний" : "есть в данных"}</span></span>
          <label className="flex items-center gap-1.5 text-xs text-neutral-600"><input type="radio" name="primary_goal" value={goal.key} defaultChecked={goal.isPrimary} />Основная</label>
          <Input name={`label:${goal.key}`} defaultValue={goal.label ?? ""} placeholder="Своё название" className="order-last col-span-2 h-8 text-sm sm:order-none sm:col-span-1" />
          <label className="flex items-center gap-1.5 text-xs text-neutral-600"><input type="checkbox" name={`show:${goal.key}`} defaultChecked={!goal.hidden} />Показывать</label>
          <label className={`flex items-center gap-1.5 text-xs text-neutral-600 ${goal.isMain ? "invisible" : ""}`}><input type="checkbox" name={`extra:${goal.key}`} defaultChecked={goal.extra} disabled={goal.isMain} />Доп. цель</label>
        </li>)}
      </ul>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Сохраняю…" : "Сохранить"}</Button>
        {state && <span role="status" className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</span>}
      </div>
    </form>
  </details>;
}
