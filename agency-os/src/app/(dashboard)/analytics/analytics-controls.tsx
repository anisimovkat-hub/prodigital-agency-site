"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, RefreshCw, Share2 } from "lucide-react";

import {
  ensureClientReport,
  syncInstagramAnalytics,
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

function query(params: AnalyticsParams, overrides: Partial<AnalyticsParams> = {}) {
  const merged = { ...params, ...overrides };
  const search = new URLSearchParams();
  if (merged.from) search.set("from", merged.from);
  if (merged.to) search.set("to", merged.to);
  if (merged.project) search.set("project", merged.project);
  if (merged.channel) search.set("channel", merged.channel);
  search.set("view", merged.view);
  return `/analytics?${search.toString()}`;
}

export function AnalyticsTabs({ params }: { params: AnalyticsParams }) {
  const tabs: { value: MarketingView; label: string }[] = [
    { value: "all", label: "Вся система" },
    { value: "organic", label: "Органика" },
    { value: "ads", label: "Реклама" },
  ];
  return (
    <div className="flex w-fit rounded-lg bg-neutral-100 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={query(params, { view: tab.value })}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition-colors",
            params.view === tab.value
              ? "bg-white text-neutral-950 shadow-sm"
              : "text-neutral-500 hover:text-neutral-900",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

export function AnalyticsFilters({
  params,
  projects,
}: {
  params: AnalyticsParams;
  projects: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 xl:flex-row xl:items-end xl:justify-between">
      <form action="/analytics" method="get" className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-[180px_180px_220px_180px_auto]">
        <input type="hidden" name="view" value={params.view} />
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">С даты<Input type="date" name="from" defaultValue={params.from} /></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">По дату<Input type="date" name="to" defaultValue={params.to} /></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">Проект<Select name="project" defaultValue={params.project}><option value="">Все проекты</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">Каналы<Select name="channel" defaultValue={params.channel}><option value="">Все каналы</option><option value="instagram">Instagram</option><option value="meta">Meta Ads</option></Select></label>
        <Button type="submit" variant="outline">Применить</Button>
      </form>
      <AnalyticsTabs params={params} />
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
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <form action={syncAction}>
        <Button type="submit" variant="outline" disabled={syncPending}>
          <RefreshCw className={cn("h-4 w-4", syncPending && "animate-spin")} />
          {syncPending ? "Обновляем…" : "Обновить Instagram"}
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
      {(syncState?.message || reportState?.message || copied) && <p aria-live="polite" className={cn("w-full text-right text-xs", syncState?.ok === false || reportState?.ok === false ? "text-red-600" : "text-emerald-700")}>{copied ? "Ссылка скопирована" : syncState?.message || reportState?.message}</p>}
    </div>
  );
}

export type { AnalyticsParams };
