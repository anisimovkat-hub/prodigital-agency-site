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
  contentSettings,
}: {
  payload: MarketingPayload;
  initialSection: MarketingSection;
  params: AnalyticsParams;
  projects: { id: string; name: string }[];
  socialAccounts: SocialAccountOption[];
  adsPanel: ReactNode;
  contentSettings?: ReactNode;
}) {
  const [section, setSection] = useState<MarketingSection>(initialSection);

  return (
    <MarketingDashboard
      payload={payload}
      section={section}
      controls={<ClientReportAction projectId={params.project} />}
      contentActions={<><InstagramSyncAction />{contentSettings}</>}
      adsPanel={adsPanel}
      audienceActions={<AudienceSyncAction />}
      filters={
        <AnalyticsFilters
          params={params}
          projects={projects}
          socialAccounts={socialAccounts}
          section={section}
          onSectionChange={setSection}
        />
      }
    />
  );
}
