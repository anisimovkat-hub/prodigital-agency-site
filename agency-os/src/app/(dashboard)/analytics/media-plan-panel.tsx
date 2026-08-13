"use client";

import { isValidElement, useActionState, type ReactElement, type ReactNode } from "react";
import { FileSpreadsheet, Plus, Settings2 } from "lucide-react";

import {
  changeMediaPlanStatus,
  importGoogleSheetMediaPlan,
  previewGoogleSheetMediaPlan,
  saveManualMediaPlan,
  type MediaPlanActionState,
} from "@/app/(dashboard)/analytics/media-plan-actions";
import { MediaPlanFactCard, type MediaPlanSummary } from "@/components/media-plan-fact-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { MediaPlanFactRow } from "@/lib/media-plan-fact";
import { MEDIA_PLAN_STATUS_LABEL } from "@/lib/labels";

type PlanListItem = MediaPlanSummary & {
  status: "draft" | "approved" | "archived";
  source_type: "manual" | "google_sheets";
};

type CampaignOption = { id: string; name: string; currency: string | null };

export function MediaPlanPanel({
  projectId,
  from,
  to,
  currencies,
  campaigns,
  plans,
  activePlan,
  factRows,
}: {
  projectId: string | null;
  from: string;
  to: string;
  currencies: string[];
  campaigns: CampaignOption[];
  plans: PlanListItem[];
  activePlan: MediaPlanSummary | null;
  factRows: MediaPlanFactRow[];
}) {
  if (!projectId) {
    return <section className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-500">Выберите один проект, чтобы увидеть и настроить плановые KPI.</section>;
  }
  const defaultCurrency = currencies[0] ?? "RUB";
  return (
    <div className="space-y-3">
      {activePlan ? (
        <MediaPlanFactCard plan={activePlan} rows={factRows} compact />
      ) : (
        <section className="rounded-xl border border-dashed border-blue-200 bg-blue-50/50 px-4 py-3 text-sm text-blue-900">
          Для выбранного проекта пока нет утверждённого медиаплана. Создайте черновик и утвердите его ниже.
        </section>
      )}
      <details className="rounded-xl border border-neutral-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-neutral-900 marker:hidden">
          <Settings2 className="h-4 w-4 text-neutral-500" /> Управление медиапланами
        </summary>
        <div className="grid gap-4 border-t border-neutral-100 p-4 xl:grid-cols-2">
          <ManualPlanForm projectId={projectId} from={from} to={to} defaultCurrency={defaultCurrency} campaigns={campaigns} />
          <GooglePlanForm projectId={projectId} from={from} to={to} defaultCurrency={defaultCurrency} />
          <div className="xl:col-span-2">
            <h3 className="text-sm font-semibold text-neutral-900">Версии</h3>
            {plans.length ? <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{plans.map((plan) => <PlanStatusRow key={plan.id} plan={plan} />)}</div> : <p className="mt-1 text-xs text-neutral-500">Версий ещё нет.</p>}
          </div>
        </div>
      </details>
    </div>
  );
}

function ManualPlanForm({ projectId, from, to, defaultCurrency, campaigns }: { projectId: string; from: string; to: string; defaultCurrency: string; campaigns: CampaignOption[] }) {
  const [state, action, pending] = useActionState<MediaPlanActionState, FormData>(saveManualMediaPlan, undefined);
  const metrics = [
    ["spend", "Рекламный бюджет"], ["impressions", "Показы"], ["clicks", "Клики"],
    ["reach", "Охват"], ["conversion", "Основные результаты"], ["revenue", "Выручка"],
  ] as const;
  return (
    <form action={action} className="rounded-xl border border-neutral-200 p-4">
      <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-blue-600" /><h3 className="text-sm font-semibold">Ручной план</h3></div>
      <input type="hidden" name="project_id" value={projectId} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field name="name" label="Название" error={state?.errors?.name}><Input name="name" id="plan-name" defaultValue={`Медиаплан ${from} — ${to}`} required /></Field>
        <Field name="workstream" label="Направление"><Input name="workstream" id="plan-workstream" placeholder="Необязательно" /></Field>
        <Field name="period_start" label="Начало" error={state?.errors?.period_start}><Input name="period_start" id="plan-start" type="date" defaultValue={from} required /></Field>
        <Field name="period_end" label="Конец" error={state?.errors?.period_end}><Input name="period_end" id="plan-end" type="date" defaultValue={to} required /></Field>
        <Field name="currency" label="Валюта" error={state?.errors?.currency}><Input name="currency" id="plan-currency" defaultValue={defaultCurrency} maxLength={3} required /></Field>
        <Field name="status" label="Статус"><Select name="status" id="plan-status" defaultValue="draft"><option value="draft">Черновик</option><option value="approved">Утверждён</option></Select></Field>
      </div>
      <div className="mt-3 grid gap-2">
        {metrics.map(([key, label]) => <div key={key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><Field name={`metric_${key}`} label={label}><Input id={`metric-${key}`} name={`metric_${key}`} type="number" min="0" step="any" placeholder="—" /></Field><Field name={`campaign_${key}`} label="Кампания (необязательно)"><Select id={`campaign-${key}`} name={`campaign_${key}`} defaultValue=""><option value="">Весь проект</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}{campaign.currency ? ` · ${campaign.currency}` : ""}</option>)}</Select></Field></div>)}
        <Field name="conversion_action_type" label="Meta action_type для результата"><Input id="conversion-action" name="conversion_action_type" placeholder="Например: lead" /></Field>
      </div>
      <ActionMessage state={state} />
      <Button className="mt-3" type="submit" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить план"}</Button>
    </form>
  );
}

function GooglePlanForm({ projectId, from, to, defaultCurrency }: { projectId: string; from: string; to: string; defaultCurrency: string }) {
  const [importState, importAction, importing] = useActionState<MediaPlanActionState, FormData>(importGoogleSheetMediaPlan, undefined);
  const [previewState, previewAction, previewing] = useActionState<MediaPlanActionState, FormData>(previewGoogleSheetMediaPlan, undefined);
  return (
    <form action={importAction} className="rounded-xl border border-neutral-200 p-4">
      <div className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-emerald-600" /><h3 className="text-sm font-semibold">Импорт Google Sheets</h3></div>
      <input type="hidden" name="project_id" value={projectId} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field name="name" label="Название" error={importState?.errors?.name}><Input name="name" id="sheet-name" defaultValue={`Импорт ${from} — ${to}`} required /></Field>
        <Field name="workstream" label="Направление"><Input name="workstream" id="sheet-workstream" placeholder="Необязательно" /></Field>
        <Field name="period_start" label="Начало" error={importState?.errors?.period_start}><Input name="period_start" id="sheet-start" type="date" defaultValue={from} required /></Field>
        <Field name="period_end" label="Конец" error={importState?.errors?.period_end}><Input name="period_end" id="sheet-end" type="date" defaultValue={to} required /></Field>
        <Field name="currency" label="Валюта" error={importState?.errors?.currency}><Input name="currency" id="sheet-currency" defaultValue={defaultCurrency} maxLength={3} required /></Field>
        <Field name="source_range" label="Диапазон" error={importState?.errors?.source_range}><Input name="source_range" id="sheet-range" defaultValue="Agency OS!A1:G100" required /></Field>
        <div className="sm:col-span-2"><Field name="source_url" label="Ссылка Google Sheets" error={importState?.errors?.source_url}><Input name="source_url" id="sheet-url" type="url" placeholder="https://docs.google.com/spreadsheets/d/…" required /></Field></div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">Колонки: metric_key, label, target_value, unit, conversion_action_type, campaign_external_id, notes. Повторный импорт всегда создаёт новый черновик.</p>
      <ActionMessage state={previewState ?? importState} />
      {previewState?.preview?.length ? <div className="mt-2 overflow-x-auto rounded-lg border"><table className="w-full min-w-[480px] text-xs"><thead className="bg-neutral-50 text-neutral-500"><tr><th className="px-2 py-2 text-left">Метрика</th><th className="px-2 py-2 text-right">План</th><th className="px-2 py-2 text-left">Ед.</th></tr></thead><tbody>{previewState.preview.map((row, index) => <tr key={`${row.metricKey}-${index}`} className="border-t"><td className="px-2 py-2">{row.label}</td><td className="px-2 py-2 text-right tabular-nums">{row.targetValue}</td><td className="px-2 py-2">{row.unit}</td></tr>)}</tbody></table></div> : null}
      <div className="mt-3 flex flex-wrap gap-2"><Button type="submit" variant="outline" formAction={previewAction} disabled={previewing || importing}>{previewing ? "Проверяем…" : "Предпросмотр"}</Button><Button type="submit" disabled={previewing || importing}>{importing ? "Импортируем…" : "Импортировать черновик"}</Button></div>
    </form>
  );
}

function PlanStatusRow({ plan }: { plan: PlanListItem }) {
  const [state, action, pending] = useActionState<MediaPlanActionState, FormData>(changeMediaPlanStatus, undefined);
  return <form action={action} className="rounded-lg border border-neutral-200 px-3 py-2"><input type="hidden" name="id" value={plan.id} /><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium text-neutral-900">{plan.name}</p><p className="mt-0.5 text-[11px] text-neutral-500">{plan.period_start}–{plan.period_end} · {plan.currency} · {plan.source_type === "manual" ? "вручную" : "Google Sheets"}</p></div><span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[11px]">{MEDIA_PLAN_STATUS_LABEL[plan.status]}</span></div><div className="mt-2 flex items-center gap-2"><Select name="status" defaultValue={plan.status} className="h-8 text-xs"><option value="draft">Черновик</option><option value="approved">Утверждён</option><option value="archived">Архив</option></Select><Button type="submit" variant="outline" className="h-8" disabled={pending}>{pending ? "…" : "Изменить"}</Button></div><ActionMessage state={state} /></form>;
}

function Field({ name, label, error, children }: { name: string; label: string; error?: string[]; children: ReactNode }) {
  const childId = isValidElement(children)
    ? (children as ReactElement<{ id?: string }>).props.id
    : undefined;
  return <div className="flex min-w-0 flex-col gap-1"><Label htmlFor={childId ?? name}>{label}</Label>{children}{error?.map((message) => <p key={message} className="text-xs text-red-600">{message}</p>)}</div>;
}

function ActionMessage({ state }: { state: MediaPlanActionState }) {
  if (!state?.message) return null;
  return <p className={`mt-2 text-xs ${state.ok ? "text-emerald-700" : "text-red-600"}`} role="status">{state.message}</p>;
}
