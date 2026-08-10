"use client";

import { useActionState, useMemo, useState } from "react";
import { Copy, ExternalLink, RefreshCw, Share2 } from "lucide-react";

import {
  ensureClientReport,
  syncInstagramAnalytics,
  syncMetaAudienceAnalytics,
  type AnalyticsActionState,
} from "@/app/(dashboard)/analytics/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { MarketingSection } from "@/lib/marketing-sections";
import { cn } from "@/lib/utils";

type AnalyticsParams = {
  from: string;
  to: string;
  project: string;
  social: string;
  section: MarketingSection;
};

type SocialAccountOption = {
  id: string;
  project_id: string | null;
  name: string;
};

export function AnalyticsTabs({
  section,
  onSectionChange,
}: {
  section: MarketingSection;
  onSectionChange: (section: MarketingSection) => void;
}) {
  const tabs: { value: MarketingSection; label: string }[] = [
    { value: "overview", label: "Обзор" },
    { value: "content", label: "Контент" },
    { value: "ads", label: "Реклама" },
    { value: "audience", label: "Аудитория" },
  ];

  function select(nextSection: MarketingSection) {
    onSectionChange(nextSection);
    const search = new URLSearchParams(window.location.search);
    search.set("section", nextSection);
    search.delete("view");
    window.history.replaceState(null, "", `/analytics?${search.toString()}`);
  }

  return (
    <div className="flex w-full overflow-x-auto rounded-lg bg-neutral-100 p-1 sm:w-fit" role="tablist" aria-label="Раздел аналитики">
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.value}
          onClick={() => select(tab.value)}
          role="tab"
          aria-selected={section === tab.value}
          className={cn(
            "min-w-fit flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
            section === tab.value
              ? "bg-white text-neutral-950 shadow-sm"
              : "text-neutral-500 hover:text-neutral-900",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function AnalyticsFilters({
  params,
  projects,
  socialAccounts,
  section,
  onSectionChange,
}: {
  params: AnalyticsParams;
  projects: { id: string; name: string }[];
  socialAccounts: SocialAccountOption[];
  section: MarketingSection;
  onSectionChange: (section: MarketingSection) => void;
}) {
  const [project, setProject] = useState(params.project);
  const visibleSocialAccounts = useMemo(
    () => socialAccounts.filter((account) => !project || account.project_id === project),
    [project, socialAccounts],
  );

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <form action="/analytics" method="get" className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(145px,0.8fr)_minmax(145px,0.8fr)_minmax(220px,1.2fr)_minmax(220px,1.2fr)_auto]">
        <input type="hidden" name="section" value={section} />
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">С даты<Input type="date" name="from" defaultValue={params.from} /></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">По дату<Input type="date" name="to" defaultValue={params.to} /></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Проект
          <Select name="project" value={project} onChange={(event) => setProject(event.target.value)}>
            <option value="">Все проекты</option>
            {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Instagram-аккаунт
          <Select name="social" defaultValue={params.social}>
            <option value="">Все аккаунты</option>
            {visibleSocialAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </Select>
        </label>
        <Button type="submit" className="h-10 bg-neutral-950 px-7 text-white hover:bg-neutral-800">Применить</Button>
      </form>
      <div className="mt-3 border-t border-neutral-100 pt-3">
        <AnalyticsTabs section={section} onSectionChange={onSectionChange} />
      </div>
    </div>
  );
}

export function InstagramSyncAction() {
  const [state, action, pending] = useActionState<AnalyticsActionState, FormData>(
    syncInstagramAnalytics,
    undefined,
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-3">
      <p className="text-sm text-neutral-600">Данные аккаунтов и публикаций Instagram</p>
      <form action={action} className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
          {pending ? "Обновляем…" : "Обновить Instagram"}
        </Button>
        {state?.message && <span aria-live="polite" className={cn("text-xs", state.ok === false ? "text-red-600" : "text-emerald-700")}>{state.message}</span>}
      </form>
    </div>
  );
}

export function AudienceSyncAction() {
  const [state, action, pending] = useActionState<AnalyticsActionState, FormData>(
    syncMetaAudienceAnalytics,
    undefined,
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-3">
      <p className="text-sm text-neutral-600">Возраст, пол, география и площадки показов Meta</p>
      <form action={action} className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
          {pending ? "Обновляем…" : "Обновить аудиторию Meta"}
        </Button>
        {state?.message && <span aria-live="polite" className={cn("text-xs", state.ok === false ? "text-red-600" : "text-emerald-700")}>{state.message}</span>}
      </form>
    </div>
  );
}

export function ClientReportAction({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<AnalyticsActionState, FormData>(
    ensureClientReport,
    undefined,
  );
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <form action={action}>
        <input type="hidden" name="project_id" value={projectId} />
        <Button type="submit" disabled={!projectId || pending}>
          <Share2 className="h-4 w-4" />
          {pending ? "Создаём…" : "Отчёт для клиента"}
        </Button>
      </form>
      {state?.url && (
        <div className="flex w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2 sm:w-auto">
          <input value={state.url} readOnly aria-label="Клиентская ссылка" className="min-w-0 flex-1 bg-transparent text-xs text-neutral-600 outline-none sm:w-60" />
          <button type="button" title="Скопировать" onClick={async () => { await navigator.clipboard.writeText(state.url!); setCopied(true); }} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><Copy className="h-4 w-4" /></button>
          <a href={state.url} target="_blank" rel="noreferrer" title="Открыть" className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><ExternalLink className="h-4 w-4" /></a>
        </div>
      )}
      {(state?.message || copied) && <p aria-live="polite" className={cn("w-full text-right text-xs", state?.ok === false ? "text-red-600" : "text-emerald-700")}>{copied ? "Ссылка скопирована" : state?.message}</p>}
    </div>
  );
}

export type { AnalyticsParams, SocialAccountOption };
