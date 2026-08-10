"use client";

import { useActionState, useState } from "react";
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
import type { MarketingView } from "@/components/marketing-dashboard";
import { cn } from "@/lib/utils";

type AnalyticsParams = {
  from: string;
  to: string;
  project: string;
  channel: string;
  view: MarketingView;
};

export function AnalyticsTabs({
  view,
  onViewChange,
}: {
  view: MarketingView;
  onViewChange: (view: MarketingView) => void;
}) {
  const tabs: { value: MarketingView; label: string }[] = [
    { value: "all", label: "Вся статистика" },
    { value: "organic", label: "Органика" },
    { value: "ads", label: "Реклама" },
  ];

  function select(nextView: MarketingView) {
    onViewChange(nextView);
    const search = new URLSearchParams(window.location.search);
    search.set("view", nextView);
    window.history.replaceState(null, "", `/analytics?${search.toString()}`);
  }

  return (
    <div className="flex w-fit rounded-lg bg-neutral-100 p-1" role="tablist" aria-label="Раздел аналитики">
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.value}
          onClick={() => select(tab.value)}
          role="tab"
          aria-selected={view === tab.value}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition-colors",
            view === tab.value
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
  view,
  onViewChange,
}: {
  params: AnalyticsParams;
  projects: { id: string; name: string }[];
  view: MarketingView;
  onViewChange: (view: MarketingView) => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <form action="/analytics" method="get" className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(210px,1.2fr)_minmax(170px,1fr)_auto]">
        <input type="hidden" name="view" value={view} />
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">С даты<Input type="date" name="from" defaultValue={params.from} /></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">По дату<Input type="date" name="to" defaultValue={params.to} /></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">Проект<Select name="project" defaultValue={params.project}><option value="">Все проекты</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">Каналы<Select name="channel" defaultValue={params.channel}><option value="">Все каналы</option><option value="instagram">Instagram</option><option value="meta">Meta Ads</option></Select></label>
        <Button type="submit" className="h-10 bg-neutral-950 px-7 text-white hover:bg-neutral-800">Применить</Button>
      </form>
      <div className="mt-3 flex justify-end border-t border-neutral-100 pt-2">
        <AnalyticsTabs view={view} onViewChange={onViewChange} />
      </div>
    </div>
  );
}

export function AnalyticsActions({ projectId }: { projectId: string }) {
  const [syncState, syncAction, syncPending] = useActionState<AnalyticsActionState, FormData>(
    syncInstagramAnalytics,
    undefined,
  );
  const [reportState, reportAction, reportPending] = useActionState<AnalyticsActionState, FormData>(
    ensureClientReport,
    undefined,
  );
  const [audienceState, audienceAction, audiencePending] = useActionState<AnalyticsActionState, FormData>(
    syncMetaAudienceAnalytics,
    undefined,
  );
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <form action={syncAction}>
        <Button type="submit" variant="outline" disabled={syncPending}>
          <RefreshCw className={cn("h-4 w-4", syncPending && "animate-spin")} />
          {syncPending ? "Обновляем…" : "Обновить Instagram"}
        </Button>
      </form>
      <form action={audienceAction}>
        <Button type="submit" variant="outline" disabled={audiencePending}>
          <RefreshCw className={cn("h-4 w-4", audiencePending && "animate-spin")} />
          {audiencePending ? "Обновляем аудиторию…" : "Обновить аудиторию Meta"}
        </Button>
      </form>
      <form action={reportAction}>
        <input type="hidden" name="project_id" value={projectId} />
        <Button type="submit" disabled={!projectId || reportPending}>
          <Share2 className="h-4 w-4" />
          {reportPending ? "Создаём…" : "Ссылка для клиента"}
        </Button>
      </form>
      {reportState?.url && (
        <div className="flex w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2 sm:w-auto">
          <input value={reportState.url} readOnly aria-label="Клиентская ссылка" className="min-w-0 flex-1 bg-transparent text-xs text-neutral-600 outline-none sm:w-60" />
          <button type="button" title="Скопировать" onClick={async () => { await navigator.clipboard.writeText(reportState.url!); setCopied(true); }} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><Copy className="h-4 w-4" /></button>
          <a href={reportState.url} target="_blank" rel="noreferrer" title="Открыть" className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"><ExternalLink className="h-4 w-4" /></a>
        </div>
      )}
      {(syncState?.message || audienceState?.message || reportState?.message || copied) && <p aria-live="polite" className={cn("w-full text-right text-xs", syncState?.ok === false || audienceState?.ok === false || reportState?.ok === false ? "text-red-600" : "text-emerald-700")}>{copied ? "Ссылка скопирована" : syncState?.message || audienceState?.message || reportState?.message}</p>}
    </div>
  );
}

export type { AnalyticsParams };
