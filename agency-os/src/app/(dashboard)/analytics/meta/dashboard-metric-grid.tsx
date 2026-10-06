"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import { dashboardStorageKey, parseMetricSelection, visibleMetricIds } from "@/lib/ad-dashboard-metrics";

type MetricOption = { id: string; label: string; group: string; defaultVisible: boolean; content: ReactNode };
const CHANGE = "agency-os:ad-metrics-changed";
const serverSnapshot = () => null;

export function DashboardMetricGrid({ userId, projectId, options, required }: {
  userId: string; projectId: string; options: MetricOption[]; required: string[];
}) {
  const storageKey = dashboardStorageKey(userId, projectId);
  const subscribe = useCallback((notify: () => void) => {
    const onStorage = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) notify(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE, notify);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(CHANGE, notify); };
  }, [storageKey]);
  const getSnapshot = useCallback(() => {
    try { return window.localStorage.getItem(storageKey); } catch { return null; }
  }, [storageKey]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const visible = visibleMetricIds(options, parseMetricSelection(raw), required);
  const [draft, setDraft] = useState<string[] | null>(null);
  const [message, setMessage] = useState("");
  const [temporary, setTemporary] = useState<string[] | null>(null);
  const shown = temporary ? visibleMetricIds(options, temporary, required) : visible;
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const open = draft !== null;
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setDraft(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setDraft(null); trigger.current?.focus(); } };
    const focusOutside = (event: FocusEvent) => { if (!container.current?.contains(event.target as Node)) setDraft(null); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    document.addEventListener("focusin", focusOutside);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); document.removeEventListener("focusin", focusOutside); };
  }, [open]);
  const close = () => { setDraft(null); trigger.current?.focus(); };
  const save = (selection: string[] | null) => {
    try {
      if (selection === null) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, JSON.stringify(selection));
      window.dispatchEvent(new Event(CHANGE));
      setTemporary(null);
      setMessage(selection === null ? "Стандартные показатели восстановлены" : "Показатели сохранены для этого проекта в этом браузере");
    } catch {
      setTemporary(selection ?? options.filter((item) => item.defaultVisible).map((item) => item.id));
      setMessage("Показатели применены. Браузер не разрешил сохранить выбор: после перезагрузки он сбросится.");
    }
    close();
  };
  const groups = [...new Set(options.map((item) => item.group))];
  const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-blue-500";
  return <section aria-label="Ключевые показатели рекламы" className="space-y-2">
    <div ref={container} className="relative flex justify-end">
      <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId}
        className={buttonClass} onClick={() => setDraft(open ? null : shown)}><Plus className="size-4" aria-hidden="true" />Добавить показатель</button>
      {open && <div ref={panel} role="dialog" aria-labelledby={`${dialogId}-title`} id={dialogId}
        className="fixed inset-x-4 top-24 bottom-24 z-40 flex flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-2 sm:w-[min(38rem,calc(100vw-2rem))]">
        <div className="flex items-center justify-between gap-2"><h3 id={`${dialogId}-title`} className="text-base font-semibold text-neutral-950">Показатели проекта</h3>
          <button type="button" aria-label="Закрыть выбор показателей" onClick={close} className="flex size-11 items-center justify-center rounded-xl text-neutral-600 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-blue-500"><X className="size-5" aria-hidden="true" /></button>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-neutral-600">Расход, количество и цена выбранной цели всегда видны. Остальные карточки можно добавить галочками. Настройка сохраняется для этого проекта в этом браузере.</p>
        <p className="mb-3 text-xs leading-relaxed text-neutral-600">Цена доступна для целей со своими кампаниями. Для дополнительных действий без отдельного расхода показываем количество, а не выдуманную цену.</p>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1 sm:max-h-[45dvh] sm:flex-auto">
          {groups.map((group) => <fieldset key={group}><legend className="mb-1 text-xs font-semibold text-neutral-500">{group}</legend>
            <div className="grid gap-1 sm:grid-cols-2">{options.filter((item) => item.group === group).map((item) => <label key={item.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-neutral-800 hover:bg-neutral-50">
              <input type="checkbox" checked={draft.includes(item.id) || required.includes(item.id)} disabled={required.includes(item.id)}
                className="size-4 accent-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500"
                onChange={(event) => setDraft(event.target.checked ? [...draft, item.id] : draft.filter((id) => id !== item.id))} />
              <span>{item.label}{required.includes(item.id) && <span className="ml-1 text-xs text-neutral-500">· основной</span>}</span>
            </label>)}</div>
          </fieldset>)}
        </div>
        <div className="mt-4 flex shrink-0 flex-wrap justify-between gap-2 border-t border-neutral-100 pt-3">
          <button type="button" className={buttonClass} onClick={() => save(null)}><RotateCcw className="size-4" aria-hidden="true" />По умолчанию</button>
          <button type="button" className="min-h-11 rounded-xl bg-neutral-950 px-4 text-sm font-medium text-white hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => save([...new Set([...draft, ...required])])}>Сохранить показатели</button>
        </div>
      </div>}
    </div>
    {message && <p role="status" className="text-xs text-neutral-600">{message}</p>}
    <div className="grid grid-cols-2 gap-2 md:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] md:gap-3">
      {options.filter((item) => shown.includes(item.id)).map((item) => <div key={item.id} data-metric-id={item.id} className={`min-w-0 [&>article]:h-full ${item.id === "spend" ? "col-span-2 md:col-span-1" : ""}`}>{item.content}</div>)}
    </div>
  </section>;
}
