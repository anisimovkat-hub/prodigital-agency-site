"use client";

import { useActionState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { saveAdDirection, type DirectionState } from "./direction-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { projectHue } from "@/lib/project-colors";
import type { AdDirection } from "@/lib/yandex-goals";

/** Выбранный чип залит основным синим, остальные — белые с заметной рамкой. */
function chipClass(selected: boolean) {
  return `inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${selected ? 'border-[1.5px] border-blue-600 bg-blue-600 text-white' : 'border-[1.5px] border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400'}`;
}

type Campaign = { id: string; name: string; counters: string[] };
type Goal = { key: string; label: string };

function DirectionForm({ projectId, direction, campaigns, goals }: { projectId: string; direction?: AdDirection; campaigns: Campaign[]; goals: Goal[] }) {
  const [state, action, pending] = useActionState<DirectionState, FormData>(saveAdDirection, undefined);
  return <form action={action} className="space-y-3 rounded-xl border border-neutral-200 p-3">
    <input type="hidden" name="project_id" value={projectId} />
    {direction && <input type="hidden" name="id" value={direction.id} />}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-neutral-600">Название направления<Input name="name" required maxLength={100} defaultValue={direction?.name} placeholder="Например, ремонт украшений" /></label>
      <label className="text-xs text-neutral-600">Номера счётчиков<Input name="counter_ids" defaultValue={direction?.counter_ids.join(', ')} placeholder="112938684" /></label>
      <label className="text-xs text-neutral-600">Сайты (через пробел)<Input name="websites" defaultValue={direction?.websites.join(' ')} placeholder="https://example.ru/" /></label>
      <label className="text-xs text-neutral-600">Основная цель<Select name="primary_goal" defaultValue={direction?.primary_goal ?? ''}><option value="">Выберите конкретную цель</option>{goals.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</Select></label>
    </div>
    <fieldset><legend className="text-xs font-medium text-neutral-700">Кампании этого направления — определяют его расход</legend><p className="my-1 text-[11px] text-neutral-500">Если одна кампания ведёт на разные продукты, не распределяйте её расход наугад: нужна отдельная детализация объявлений.</p>
      <div className="max-h-56 overflow-y-auto space-y-1">{campaigns.map((c) => <label key={c.id} className="flex items-start gap-2 py-1 text-xs text-neutral-700"><input type="checkbox" name="campaign_id" value={c.id} defaultChecked={direction?.campaign_ids.includes(c.id)} /><span>{c.name}<span className="ml-1 text-neutral-400">{c.counters.length ? ` · счётчики ${c.counters.join(', ')}` : ''}</span></span></label>)}</div>
    </fieldset>
    <label className="flex gap-2 text-xs text-neutral-700"><input type="checkbox" name="is_active" defaultChecked={direction?.is_active ?? true} />Сейчас рекламируется</label>
    <div className="flex items-center gap-3"><Button size="sm" disabled={pending}>{pending ? 'Сохраняю…' : 'Сохранить направление'}</Button>{state && <span role="status" className={`text-xs ${state.ok ? 'text-emerald-700' : 'text-red-600'}`}>{state.message}</span>}</div>
  </form>;
}

export function AdDirections({ projectId, directions, campaigns, goals, current, summaries, clientHref }: {
  projectId: string; directions: AdDirection[]; campaigns: Campaign[]; goals: Goal[]; current: string;
  summaries: { id: string; spend: string; count: string; cpa: string; goal: string }[];
  clientHref?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (id: string) => { const next = new URLSearchParams(params.toString()); next.delete('goal'); next.delete('campaign'); next.delete('account'); if (id) next.set('direction', id); else next.delete('direction'); return `${pathname}?${next}`; };
  return <section className="space-y-2" aria-label="Направления продвижения">
    {!!directions.length && <div className="flex flex-wrap gap-2"><Link href={current && clientHref ? `${clientHref}#reports` : href('')} className={chipClass(!current)}>{current && clientHref ? 'Все отчёты клиента' : 'Все направления'}</Link>{directions.map((d) => { const spend = summaries.find((s) => s.id === d.id)?.spend; return <Link key={d.id} href={href(d.id)} aria-current={current === d.id ? 'page' : undefined} className={`${chipClass(current === d.id)} ${!d.is_active && current !== d.id ? 'text-neutral-500' : ''}`}><span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: `hsl(${projectHue(d.id)} 65% 48%)` }} />{d.name}{d.is_active && spend && spend !== '—' && <span className={current === d.id ? 'text-blue-100' : 'text-neutral-500'}>{spend}</span>}{!d.is_active && <span>· не рекламируется</span>}</Link>; })}</div>}
    {!current && !!directions.length && <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{directions.filter((d) => d.is_active).map((d) => { const s = summaries.find((s) => s.id === d.id); return <Link key={d.id} href={href(d.id)} className="rounded-xl border border-neutral-200 bg-white p-3"><p className="text-sm font-semibold">{d.name}</p><p className="mt-1 text-[11px] text-neutral-500">{d.counter_ids.map((id) => `№ ${id}`).join(' · ')}</p><p className="mt-2 text-xs text-neutral-700">Расход {s?.spend ?? '—'} · {s?.goal || 'Цель не выбрана'}: {s?.count ?? '—'} · цена {s?.cpa ?? '—'}</p>{!d.campaign_ids.length && <p className="mt-1 text-[11px] text-amber-700">Нужно привязать рекламные кампании</p>}</Link>; })}</div>}
    <details className="rounded-xl border border-neutral-200 bg-white p-3"><summary className="cursor-pointer text-xs font-medium text-neutral-600">Настроить направления и счётчики</summary><p className="my-3 text-xs text-neutral-500">Один проект, несколько продуктов: у каждого свои кампании, счётчик и основная цель. Разные цели не складываются в общую цифру заявок.</p><div className="space-y-3">{directions.map((d) => <details key={d.id}><summary className="mb-2 cursor-pointer text-sm font-medium">{d.name}</summary><DirectionForm projectId={projectId} direction={d} campaigns={campaigns} goals={goals} /></details>)}<details><summary className="mb-2 cursor-pointer text-sm font-medium">+ Добавить направление</summary><DirectionForm projectId={projectId} campaigns={campaigns} goals={goals} /></details></div></details>
  </section>;
}
