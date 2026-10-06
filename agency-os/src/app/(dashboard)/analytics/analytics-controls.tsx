"use client";

import { useActionState, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChartNoAxesCombined,
  Copy,
  ExternalLink,
  Images,
  Megaphone,
  RefreshCw,
  Share2,
} from "lucide-react";

import {
  assignSocialAccount,
  ensureClientReport,
  syncInstagramAnalytics,
  syncMetaAudienceAnalytics,
  type AnalyticsActionState,
} from "@/app/(dashboard)/analytics/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AnalyticsPeriodPicker } from "@/app/(dashboard)/analytics/analytics-period-picker";
import { FilterSelect } from "@/app/(dashboard)/analytics/meta/ads-filters";
import { analyticsSectionHref, type MarketingSection } from "@/lib/marketing-sections";
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

export function PortfolioAnalyticsControls({
  from,
  to,
  projects,
  search,
  onSearchChange,
}: {
  from: string;
  to: string;
  projects: { id: string; name: string }[];
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const router = useRouter();

  function navigateToProject(projectId: string) {
    if (!projectId) return;
    router.push(`/analytics?project=${encodeURIComponent(projectId)}&section=ads`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[560px]">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Перейти к проекту
          <Select defaultValue="" onChange={(event) => navigateToProject(event.target.value)}>
            <option value="">Выберите проект</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Поиск по названию
          <Input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Например, Озимо" />
        </label>
      </div>
      <AnalyticsPeriodPicker
        key={`${from}-${to}`}
        period={{ from, to }}
        onApply={(period) => router.push(`/analytics?from=${period.from}&to=${period.to}`)}
      />
    </div>
  );
}

export function InstagramAccountAssignment({
  account,
  projects,
}: {
  account: {
    id: string;
    projectId: string | null;
    label: string;
    details: string;
  };
  projects: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<AnalyticsActionState, FormData>(
    assignSocialAccount,
    undefined,
  );
  return (
    <form action={action} className="flex flex-wrap items-center gap-3 rounded-lg bg-neutral-50 p-3">
      <input type="hidden" name="account_id" value={account.id} />
      <span className="min-w-48">
        <span className="block text-sm font-medium text-neutral-900">{account.label}</span>
        <span className="block text-xs text-neutral-500">{account.details}</span>
      </span>
      <Select name="project_id" defaultValue={account.projectId ?? ""} className="max-w-72">
        <option value="">Не привязан</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </Select>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Сохраняем…" : "Сохранить привязку"}
      </Button>
      {state?.message && (
        <span
          aria-live="polite"
          className={cn("w-full text-xs", state.ok === false ? "text-red-600" : "text-emerald-700")}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}

export function AnalyticsTabs({
  section,
}: {
  section: MarketingSection;
}) {
  const tabs = [
    { value: "overview" as const, label: "Обзор", icon: ChartNoAxesCombined },
    { value: "content" as const, label: "Контент", icon: Images },
    { value: "ads" as const, label: "Реклама", icon: Megaphone },
  ];

  function select(nextSection: MarketingSection) {
    if (nextSection === section) return;
    window.history.pushState(null, "", analyticsSectionHref(window.location.search, nextSection));
  }

  return (
    <div className="flex w-full rounded-xl bg-neutral-100 p-1 sm:inline-flex sm:w-auto" role="tablist" aria-label="Раздел аналитики">
      {tabs.map((tab) => (
        <button type="button" key={tab.value} onClick={() => select(tab.value)} role="tab" aria-selected={section === tab.value}
          className={cn("inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition sm:flex-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950",
            section === tab.value ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500 hover:text-neutral-900")}>
          <tab.icon className="size-4" aria-hidden="true" />{tab.label}
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
}: {
  params: AnalyticsParams;
  projects: { id: string; name: string }[];
  socialAccounts: SocialAccountOption[];
  section: MarketingSection;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const project = params.project;
  const visibleSocialAccounts = useMemo(
    () => socialAccounts.filter((account) => !project || account.project_id === project),
    [project, socialAccounts],
  );

  function navigate(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
          <FilterSelect prefix="Проект:" label={projects.find((item) => item.id === project)?.name ?? "Все проекты"} value={project} onChange={(value) => navigate({ project: value, social: "", account: "", campaign: "", goal: "" })}>
            <option value="">Все проекты</option>
            {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </FilterSelect>
        <div className="order-first col-span-2 md:order-none md:col-span-1"><AnalyticsPeriodPicker compact key={`${params.from}-${params.to}`} period={{ from: params.from, to: params.to }} onApply={(period) => navigate(period)} /></div>
        {section !== "ads" && <FilterSelect icon={<Images className="size-4" />} prefix="Instagram:" label={visibleSocialAccounts.find((account) => account.id === params.social)?.name ?? "Все аккаунты"} value={params.social} onChange={(value) => navigate({ social: value })}>
            <option value="">Все аккаунты</option>
            {visibleSocialAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </FilterSelect>}
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
      <form action={action}>
        <Button type="submit" variant="outline" disabled={pending}>
          <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
          {pending ? "Обновляем…" : "Обновить Instagram"}
        </Button>
      </form>
      {state?.message && (
        <p
          aria-live="polite"
          className={cn(
            "w-full rounded-md border px-3 py-2 text-xs leading-relaxed",
            state.ok === false
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800",
          )}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

export function AudienceSyncAction({ projectId = "" }: { projectId?: string }) {
  const [state, action, pending] = useActionState<AnalyticsActionState, FormData>(
    syncMetaAudienceAnalytics,
    undefined,
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-3">
      <p className="text-sm text-neutral-600">Возраст, пол, география и площадки показов Meta</p>
      <form action={action} className="flex items-center gap-3">
        <input type="hidden" name="project_id" value={projectId} />
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
        <Button type="submit" disabled={!projectId || pending} aria-label="Отчёт для клиента" title="Отчёт для клиента">
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">{pending ? "Создаём…" : "Отчёт для клиента"}</span>
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
