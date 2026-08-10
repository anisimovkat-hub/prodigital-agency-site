"use client";

import { useState } from "react";

import {
  AnalyticsActions,
  AnalyticsFilters,
  type AnalyticsParams,
} from "@/app/(dashboard)/analytics/analytics-controls";
import {
  MarketingDashboard,
  type MarketingView,
} from "@/components/marketing-dashboard";
import type { MarketingPayload } from "@/lib/marketing-analytics";

export function AnalyticsShell({
  payload,
  initialView,
  params,
  projects,
}: {
  payload: MarketingPayload;
  initialView: MarketingView;
  params: AnalyticsParams;
  projects: { id: string; name: string }[];
}) {
  const [view, setView] = useState<MarketingView>(initialView);

  return (
    <MarketingDashboard
      payload={payload}
      view={view}
      controls={<AnalyticsActions projectId={params.project} />}
      filters={
        <AnalyticsFilters
          params={params}
          projects={projects}
          view={view}
          onViewChange={setView}
        />
      }
    />
  );
}
