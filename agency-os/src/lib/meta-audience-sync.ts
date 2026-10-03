import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMetaAudienceInsights } from "@/lib/meta-ads";
import type { Database } from "@/lib/supabase/types";
import type { AnalyticsPeriod } from "@/lib/analytics-period";

export type AudienceSyncResult = {
  rows: number;
  failedAccounts: number;
  failedBreakdowns: string[];
};

export async function syncMetaAudienceData(
  supabase: SupabaseClient<Database>,
  period: AnalyticsPeriod,
  projectId?: string,
): Promise<AudienceSyncResult> {
  let accountsQuery = supabase.from("ad_accounts").select("id,external_id,name").eq("platform", "meta");
  let campaignsQuery = supabase.from("ad_campaigns").select("id,external_id,ad_account_id");
  if (projectId) {
    accountsQuery = accountsQuery.eq("project_id", projectId);
    campaignsQuery = campaignsQuery.eq("project_id", projectId);
  }
  const [{ data: accounts, error: accountsError }, { data: campaigns, error: campaignsError }] = await Promise.all([accountsQuery, campaignsQuery]);
  if (accountsError) throw new Error(accountsError.message);
  if (campaignsError) throw new Error(campaignsError.message);
  if (!accounts?.length) return { rows: 0, failedAccounts: 0, failedBreakdowns: [] };

  const campaignByExternal = new Map((campaigns ?? []).map((campaign) => [`${campaign.ad_account_id}:${campaign.external_id}`, campaign.id]));
  let totalRows = 0;
  let failedAccounts = 0;
  const failedBreakdowns: string[] = [];

  // Bound concurrent API requests: every account makes five separate breakdown queries.
  for (let start = 0; start < accounts.length; start += 2) {
    const results = await Promise.allSettled(accounts.slice(start, start + 2).map(async (account) => ({
      account,
      insights: await fetchMetaAudienceInsights(account.external_id, period.from, period.to),
    })));
    for (const result of results) {
      if (result.status === "rejected") { failedAccounts += 1; continue; }
      failedBreakdowns.push(...result.value.insights.failures.map((failure) => failure.breakdown));
      const rows = result.value.insights.metrics.flatMap((metric) => {
        const campaignId = campaignByExternal.get(`${result.value.account.id}:${metric.campaignExternalId}`);
        return campaignId ? [{
          campaign_id: campaignId,
          date: metric.date,
          breakdown: metric.breakdown,
          value: metric.value,
          impressions: metric.impressions,
          reach: metric.reach,
          clicks: metric.clicks,
          spend: metric.spend,
          conversion_actions: metric.conversions,
        }] : [];
      });
      for (let index = 0; index < rows.length; index += 500) {
        const batch = rows.slice(index, index + 500);
        const { error } = await supabase.from("ad_audience_metrics").upsert(batch, { onConflict: "campaign_id,date,breakdown,value" });
        if (error) throw new Error(error.message);
        totalRows += batch.length;
      }
    }
  }
  return { rows: totalRows, failedAccounts, failedBreakdowns };
}
