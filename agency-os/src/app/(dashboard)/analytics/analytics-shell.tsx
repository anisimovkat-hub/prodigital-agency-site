"use client";

import { type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

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
      {portfolioOverview ?? <MarketingDashboard
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
