import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { fetchRequiredYandexReportDays, YANDEX_REPORT_BACKFILL_PERIOD } from "@/lib/connected-ads-sync";

/** Idempotent conversion-only upsert. Existing traffic, other actions/dates/accounts stay untouched. */
export async function backfillRequiredYandexReports(client: SupabaseClient<Database>, accountId: string) {
  const reports: { attribution: string; goalIds: string[]; sha256: string; tsv: string }[] = [];
  const { account, days, requirement } = await fetchRequiredYandexReportDays(client, accountId, (report) => {
    reports.push({ ...report, sha256: createHash("sha256").update(report.tsv).digest("hex") });
  });
  const { data: campaigns, error } = await client.from("ad_campaigns").select("id,external_id")
    .eq("ad_account_id", account.id).eq("project_id", account.project_id);
  if (error) throw new Error("REPORT_CAMPAIGN_LOOKUP_FAILED");
  const byExternalId = new Map((campaigns ?? []).map((campaign) => [campaign.external_id, campaign.id]));
  const allowedActions = new Set(requirement.goalIds.flatMap((id) => [`yandex_goal:${id}:LC`, `yandex_goal:${id}:${requirement.attribution}`]));
  const rows = days.flatMap((day) => {
    const campaignId = byExternalId.get(day.campaignId);
    if (!campaignId || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || day.date < YANDEX_REPORT_BACKFILL_PERIOD.from || day.date > YANDEX_REPORT_BACKFILL_PERIOD.to)
      throw new Error("REPORT_CAMPAIGN_OR_DATE_MISMATCH");
    return (day.goalResults ?? []).map((goal) => {
      if (!allowedActions.has(goal.action)) throw new Error("REPORT_ACTION_MISMATCH");
      return { campaign_id: campaignId, date: day.date, action_type: goal.action, count: goal.count ?? 0, is_measured: goal.count !== null,
        value: goal.value ?? 0, value_is_measured: goal.value !== null && goal.value !== undefined };
    });
  });
  const unique = new Set(rows.map((row) => `${row.campaign_id}:${row.date}:${row.action_type}`));
  if (!rows.length || unique.size !== rows.length || rows.length > byExternalId.size * 14 * allowedActions.size)
    throw new Error("REPORT_ROW_BOUND_EXCEEDED");
  // Validate every row before the first write. Failed batches can be retried with no duplicates.
  for (let index = 0; index < rows.length; index += 500) {
    const { error: writeError } = await client.from("ad_conversions").upsert(rows.slice(index, index + 500), { onConflict: "campaign_id,date,action_type" });
    if (writeError) throw new Error("REPORT_CONVERSION_WRITE_FAILED");
  }
  return { accountId: account.id, externalId: requirement.externalId, period: YANDEX_REPORT_BACKFILL_PERIOD,
    models: ["LC", requirement.attribution], goals: [...requirement.goalIds], campaignDays: days.length,
    conversionRows: rows.length, measuredRows: rows.filter((row) => row.is_measured).length,
    unknownRows: rows.filter((row) => !row.is_measured).length, reports };
}
