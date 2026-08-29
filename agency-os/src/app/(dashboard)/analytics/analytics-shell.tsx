"use client";

import { useState, type ReactNode } from "react";

import {
  AudienceSyncAction,
  AnalyticsFilters,
  ClientReportAction,
  InstagramSyncAction,
  type AnalyticsParams,
  type SocialAccountOption,
} from "@/app/(dashboard)/analytics/analytics-controls";
import {
  MarketingDashboard,
} from "@/components/marketing-dashboard";
import type { MarketingPayload } from "@/lib/marketing-analytics";
import type { MarketingSection } from "@/lib/marketing-sections";

export function AnalyticsShell({
  payload,
  initialSection,
  params,
  projects,
  socialAccounts,
  adsPanel,
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
  mediaPlan?: ReactNode;
  contentSettings?: ReactNode;
  dataWarnings?: string[];
  portfolioOverview?: ReactNode;
}) {
  const [section, setSection] = useState<MarketingSection>(initialSection);

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
        contentActions={<><InstagramSyncAction />{contentSettings}</>}
        adsPanel={adsPanel}
        mediaPlan={mediaPlan}
        audienceActions={<AudienceSyncAction projectId={params.project} />}
        filters={
          <AnalyticsFilters
            params={params}
            projects={projects}
            socialAccounts={socialAccounts}
            section={section}
            onSectionChange={setSection}
          />
        }
      />}
    </>
  );
}
