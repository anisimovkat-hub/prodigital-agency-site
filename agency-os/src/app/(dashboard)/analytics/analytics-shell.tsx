"use client";

import { type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  AnalyticsFilters,
  AnalyticsTabs,
  ClientReportAction,
  InstagramSyncAction,
  type AnalyticsParams,
  type SocialAccountOption,
} from "@/app/(dashboard)/analytics/analytics-controls";
import {
  MarketingDashboard,
} from "@/components/marketing-dashboard";
import type { MarketingPayload } from "@/lib/marketing-analytics";
import { marketingSection, type MarketingSection } from "@/lib/marketing-sections";

export function AnalyticsShell({
  payload,
  initialSection,
  params,
  projects,
  socialAccounts,
  adsPanel,
  adsFilters,
  mediaPlan,
  contentSettings,
  dataWarnings = [],
  portfolioOverview,
  directionReport,
}: {
  payload: MarketingPayload;
  initialSection: MarketingSection;
  params: AnalyticsParams;
  projects: { id: string; name: string }[];
  socialAccounts: SocialAccountOption[];
  adsPanel: ReactNode;
  adsFilters?: ReactNode;
  mediaPlan?: ReactNode;
  contentSettings?: ReactNode;
  dataWarnings?: string[];
  portfolioOverview?: ReactNode;
  directionReport?: { name: string; clientHref: string; websites: string[] };
}) {
  const searchParams = useSearchParams();
  // URL is the single source of truth, including browser Back/Forward.
  const section = marketingSection(searchParams.get("section") ?? initialSection, searchParams.get("view"));

  return (
    <>
      {dataWarnings.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          <p className="font-semibold">Часть аналитики временно недоступна</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
            {dataWarnings.slice(0, 4).map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}
      {directionReport ? <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
        <Link href={directionReport.clientHref} className="inline-flex w-fit items-center gap-2 rounded-md py-1 text-sm text-neutral-600 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"><ArrowLeft className="size-4" aria-hidden="true" />Вернуться к клиенту</Link>
        <header><p className="text-xs text-neutral-500">Отдельный отчёт направления</p><h1 className="mt-1 text-xl font-semibold text-neutral-950 sm:text-2xl">{directionReport.name}</h1><p className="mt-1 break-words text-sm text-neutral-500">{directionReport.websites[0]}</p><p className="mt-2 text-xs text-neutral-500">Показатели рассчитаны только по кампаниям и целям этого направления.</p></header>
        {adsFilters}
        {adsPanel}
      </div> : portfolioOverview ?? <MarketingDashboard
        payload={payload}
        section={section}
        controls={<ClientReportAction projectId={params.project} />}
        contentActions={<details className="rounded-2xl border border-neutral-200 bg-white px-4 py-3"><summary className="cursor-pointer text-sm font-medium text-neutral-700">Источники и обновление Instagram</summary><div className="mt-3 space-y-3"><InstagramSyncAction />{contentSettings}</div></details>}
        adsPanel={adsPanel}
        mediaPlan={mediaPlan}
        filters={
          <div className="space-y-3"><AnalyticsTabs section={section} />{section !== "content" && adsFilters ? adsFilters : <AnalyticsFilters
            params={params}
            projects={projects}
            socialAccounts={socialAccounts}
            section={section}
          />}</div>
        }
      />}
    </>
  );
}
