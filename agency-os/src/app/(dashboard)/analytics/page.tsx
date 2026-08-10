import { assignSocialAccount } from "@/app/(dashboard)/analytics/actions";
import {
  type AnalyticsParams,
} from "@/app/(dashboard)/analytics/analytics-controls";
import { AnalyticsShell } from "@/app/(dashboard)/analytics/analytics-shell";
import {
  type MarketingView,
} from "@/components/marketing-dashboard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  actionTypeLabel,
  GOAL_ACTION_TYPES,
  isGoalAction,
  summarizeCampaigns,
  type ConversionRow as AdSummaryConversionRow,
} from "@/lib/ad-analytics";
import type {
  MarketingAdDetail,
  MarketingAudience,
  MarketingDailyPoint,
  MarketingPayload,
  MarketingPost,
} from "@/lib/marketing-analytics";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

type SearchParams = {
  from?: string;
  to?: string;
  project?: string;
  channel?: string;
  view?: string;
};

type SocialMetricRow = {
  date: string;
  reach: number;
  impressions: number;
  engagements: number;
  follower_growth: number;
};

type CampaignMetricRow = {
  campaign_id: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
};

type ConversionRow = {
  campaign_id: string;
  date: string;
  action_type: string;
  count: number;
  value: number;
};

type AudienceRow = {
  campaign_id: string;
  breakdown: "age" | "gender" | "country" | "region" | "publisher_platform";
  value: string;
  impressions: number;
  reach: number;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}
function validView(value: string | undefined): MarketingView {
  return value === "organic" || value === "ads" ? value : "all";
}

function primaryConversions(rows: ConversionRow[]): ConversionRow[] {
  const priority = new Map(GOAL_ACTION_TYPES.map((value, index) => [value, index]));
  const selected = new Map<string, ConversionRow>();
  for (const row of rows) {
    const key = `${row.campaign_id}:${row.date}`;
    const current = selected.get(key);
    const rank = priority.get(row.action_type) ?? GOAL_ACTION_TYPES.length;
    const currentRank = current
      ? priority.get(current.action_type) ?? GOAL_ACTION_TYPES.length
      : Number.POSITIVE_INFINITY;
    if (!current || rank < currentRank || (rank === currentRank && row.count > current.count)) {
      selected.set(key, row);
    }
  }
  return [...selected.values()];
}

type PeriodSummaryLike = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: { action_type: string; count: number; value: number }[];
};

function summarizeEntities<T extends PeriodSummaryLike>(
  rows: T[],
  idOf: (row: T) => string,
) {
  const metrics = rows.map((row) => ({
    campaign_id: idOf(row),
    spend: Number(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
  }));
  const conversions: AdSummaryConversionRow[] = rows.flatMap((row) =>
    (row.conversions ?? []).map((conversion) => ({
      campaign_id: idOf(row),
      action_type: conversion.action_type,
      count: Number(conversion.count ?? 0),
      value: Number(conversion.value ?? 0),
    })),
  );
  return summarizeCampaigns(metrics, conversions);
}

function countryLabel(value: string): string {
  try {
    return new Intl.DisplayNames(["ru"], { type: "region" }).of(value.toUpperCase()) ?? value;
  } catch {
    return value;
  }
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  if (profile?.role !== "owner") {
    return <div><h1 className="text-2xl font-semibold text-neutral-900">Аналитика</h1><p className="mt-2 text-sm text-neutral-500">Раздел доступен только владельцу.</p></div>;
  }

  const raw = await searchParams;
  const from = raw.from && ISO_DATE.test(raw.from) ? raw.from : daysAgo(29);
  const to = raw.to && ISO_DATE.test(raw.to) ? raw.to : daysAgo(0);
  const projectId = raw.project ?? "";
  const channel = raw.channel === "instagram" || raw.channel === "meta" ? raw.channel : "";
  const view = validView(raw.view);

  const [
    { data: projects },
    { data: socialAccounts },
    { data: campaigns },
    { data: adAccounts },
    { data: adSets },
    { data: ads },
    { data: customConversions },
  ] = await Promise.all([
    supabase.from("projects").select("id,name,logo_url").order("name"),
    supabase
      .from("social_accounts")
      .select("id,project_id,username,name,profile_picture_url,followers_count,last_synced_at")
      .eq("platform", "instagram")
      .order("name"),
    supabase.from("ad_campaigns").select("id,name,objective,status,project_id,ad_account_id"),
    supabase.from("ad_accounts").select("id,project_id,currency"),
    supabase.from("ad_sets").select("id,name,status,campaign_id"),
    supabase.from("ads").select("id,name,status,adset_id"),
    supabase.from("ad_custom_conversions").select("conversion_id,name"),
  ]);

  const projectRows = projects ?? [];
  const accountRows = socialAccounts ?? [];
  const selectedSocial = accountRows.filter((account) => !projectId || account.project_id === projectId);
  const socialIds = selectedSocial.map((account) => account.id);
  const campaignRows = (campaigns ?? []).filter((campaign) => !projectId || campaign.project_id === projectId);
  const campaignIds = new Set(campaignRows.map((campaign) => campaign.id));

  const socialMetricsPromise = socialIds.length
    ? supabase
        .from("social_account_metrics")
        .select("date,reach,impressions,engagements,follower_growth")
        .in("social_account_id", socialIds)
        .gte("date", from)
        .lte("date", to)
        .range(0, 9999)
    : Promise.resolve({ data: [] as SocialMetricRow[], error: null });
  const socialPostsPromise = socialIds.length
    ? supabase
        .from("social_posts")
        .select("caption,media_type,media_url,thumbnail_url,permalink,published_at,reach,views,likes,comments,saved,shares,engagements")
        .in("social_account_id", socialIds)
        .gte("published_at", `${from}T00:00:00Z`)
        .lte("published_at", `${to}T23:59:59Z`)
        .order("reach", { ascending: false })
        .range(0, 49)
    : Promise.resolve({ data: [], error: null });

  const [
    { data: socialMetrics },
    { data: socialPosts },
    { data: paidMetrics },
    { data: conversions },
    { data: campaignSummary },
    { data: adSetSummary },
    { data: adSummary },
    { data: audienceMetrics },
  ] = await Promise.all([
    socialMetricsPromise,
    socialPostsPromise,
    supabase
      .from("ad_campaign_metrics")
      .select("campaign_id,date,spend,impressions,clicks,reach")
      .gte("date", from)
      .lte("date", to)
      .range(0, 9999),
    supabase
      .from("ad_conversions")
      .select("campaign_id,date,action_type,count,value")
      .gte("date", from)
      .lte("date", to)
      .range(0, 19999),
    supabase.rpc("ad_campaign_period_summary", { p_since: from, p_until: to }),
    supabase.rpc("ad_set_period_summary", { p_since: from, p_until: to }),
    supabase.rpc("ad_ad_period_summary", { p_since: from, p_until: to }),
    supabase
      .from("ad_audience_metrics")
      .select("campaign_id,breakdown,value,impressions,reach")
      .gte("date", from)
      .lte("date", to)
      .range(0, 19999),
  ]);

  const organicRows = (socialMetrics ?? []) as SocialMetricRow[];
  const paidRows = ((paidMetrics ?? []) as CampaignMetricRow[]).filter((row) => campaignIds.has(row.campaign_id));
  const allGoalConversions = ((conversions ?? []) as ConversionRow[]).filter(
    (row) => campaignIds.has(row.campaign_id) && isGoalAction(row.action_type),
  );
  const conversionRows = primaryConversions(allGoalConversions);
  const posts: MarketingPost[] = (socialPosts ?? []).map((post) => ({
    caption: post.caption,
    mediaType: post.media_type,
    imageUrl: post.thumbnail_url || post.media_url,
    permalink: post.permalink,
    publishedAt: post.published_at,
    reach: Number(post.reach),
    views: Number(post.views),
    likes: Number(post.likes),
    comments: Number(post.comments),
    saved: Number(post.saved),
    shares: Number(post.shares),
    engagements: Number(post.engagements),
  }));

  const daily = new Map<string, MarketingDailyPoint>();
  const ensureDay = (date: string) => {
    const existing = daily.get(date);
    if (existing) return existing;
    const point: MarketingDailyPoint = { date, organicReach: 0, paidReach: 0, spend: 0, engagements: 0, conversions: 0 };
    daily.set(date, point);
    return point;
  };
  for (const row of organicRows) {
    const point = ensureDay(row.date);
    point.organicReach += Number(row.reach);
    point.engagements += Number(row.engagements);
  }
  for (const row of paidRows) {
    const point = ensureDay(row.date);
    point.paidReach += Number(row.reach);
    point.spend += Number(row.spend);
  }
  for (const row of conversionRows) ensureDay(row.date).conversions += Number(row.count);

  const organicReach = organicRows.reduce((sum, row) => sum + Number(row.reach), 0);
  const organicEngagements = organicRows.reduce((sum, row) => sum + Number(row.engagements), 0);
  const spend = paidRows.reduce((sum, row) => sum + Number(row.spend), 0);
  const clicks = paidRows.reduce((sum, row) => sum + Number(row.clicks), 0);
  const impressions = paidRows.reduce((sum, row) => sum + Number(row.impressions), 0);
  const conversionCount = conversionRows.reduce((sum, row) => sum + Number(row.count), 0);
  const conversionValue = conversionRows.reduce((sum, row) => sum + Number(row.value), 0);
  const campaignAccountIds = new Set(campaignRows.map((campaign) => campaign.ad_account_id));
  const currencies = [...new Set((adAccounts ?? []).filter((account) => campaignAccountIds.has(account.id) && account.currency).map((account) => account.currency!))];
  const selectedProject = projectRows.find((project) => project.id === projectId);
  const hideOrganic = channel === "meta";
  const hidePaid = channel === "instagram";

  const customNames = new Map(
    (customConversions ?? [])
      .filter((conversion) => conversion.name)
      .map((conversion) => [conversion.conversion_id, conversion.name!]),
  );
  const accountCurrency = new Map(
    (adAccounts ?? []).map((account) => [account.id, account.currency]),
  );
  const campaignById = new Map(campaignRows.map((campaign) => [campaign.id, campaign]));
  const adSetById = new Map((adSets ?? []).map((adSet) => [adSet.id, adSet]));
  const adSetSummaries = summarizeEntities(adSetSummary ?? [], (row) => row.adset_id);
  const adSummaries = summarizeEntities(adSummary ?? [], (row) => row.ad_id);
  const campaignSummaries = summarizeEntities(campaignSummary ?? [], (row) => row.campaign_id);

  function detailRow(
    id: string,
    name: string | null,
    parentName: string,
    campaignId: string,
    summary: NonNullable<ReturnType<typeof adSetSummaries.get>>,
  ): MarketingAdDetail {
    const campaign = campaignById.get(campaignId);
    const primary = summary.primaryGoal;
    return {
      id,
      name: name || "Без названия",
      parentName,
      spend: summary.spend,
      impressions: summary.impressions,
      clicks: summary.clicks,
      ctr: summary.ctr,
      results: primary?.count ?? null,
      resultLabel: primary ? actionTypeLabel(primary.actionType, customNames) : null,
      cpa: summary.cpa,
      currency: campaign ? accountCurrency.get(campaign.ad_account_id) ?? null : null,
    };
  }

  const detailAdSets = (adSets ?? [])
    .flatMap((adSet) => {
      if (!campaignIds.has(adSet.campaign_id)) return [];
      const summary = adSetSummaries.get(adSet.id);
      if (!summary) return [];
      return [detailRow(
        adSet.id,
        adSet.name,
        campaignById.get(adSet.campaign_id)?.name || "Кампания без названия",
        adSet.campaign_id,
        summary,
      )];
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 15);
  const detailAds = (ads ?? [])
    .flatMap((ad) => {
      const adSet = adSetById.get(ad.adset_id);
      if (!adSet || !campaignIds.has(adSet.campaign_id)) return [];
      const summary = adSummaries.get(ad.id);
      if (!summary) return [];
      return [detailRow(
        ad.id,
        ad.name,
        adSet.name || "Группа без названия",
        adSet.campaign_id,
        summary,
      )];
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 15);
  const campaignResults = campaignRows
    .flatMap((campaign) => {
      const summary = campaignSummaries.get(campaign.id);
      if (!summary) return [];
      const trafficPriority = [
        "landing_page_view",
        "omni_landing_page_view",
        "link_click",
        "instagram_profile_visit",
        "post_engagement",
        "video_view",
      ];
      const fallbackOutcome = trafficPriority
        .map((actionType) => summary.otherActions.find((action) => action.actionType === actionType))
        .find((action) => action !== undefined);
      const outcomes = summary.primaryGoal
        ? [summary.primaryGoal]
        : fallbackOutcome
          ? [fallbackOutcome]
          : [];
      return [{
        id: campaign.id,
        name: campaign.name || "Кампания без названия",
        objective: campaign.objective,
        spend: summary.spend,
        currency: accountCurrency.get(campaign.ad_account_id) ?? null,
        goals: outcomes.map((goal) => ({
          actionType: goal.actionType,
          label: actionTypeLabel(goal.actionType, customNames),
          count: goal.count,
          cpa: goal.count > 0 ? summary.spend / goal.count : null,
        })),
      }];
    })
    .sort((a, b) => b.spend - a.spend);

  const audienceTotals = new Map<string, { impressions: number; reach: number }>();
  for (const row of (audienceMetrics ?? []) as AudienceRow[]) {
    if (!campaignIds.has(row.campaign_id)) continue;
    const key = `${row.breakdown}:${row.value}`;
    const current = audienceTotals.get(key) ?? { impressions: 0, reach: 0 };
    current.impressions += Number(row.impressions);
    current.reach += Number(row.reach);
    audienceTotals.set(key, current);
  }
  const audienceList = (
    breakdown: AudienceRow["breakdown"],
    label: (value: string) => string = (value) => value,
  ) => [...audienceTotals.entries()]
    .filter(([key]) => key.startsWith(`${breakdown}:`))
    .map(([key, totals]) => ({
      label: label(key.slice(breakdown.length + 1)),
      ...totals,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);
  const audience: MarketingAudience = {
    age: audienceList("age"),
    gender: audienceList("gender", (value) => ({ male: "Мужчины", female: "Женщины", unknown: "Не указан" })[value] ?? value),
    country: audienceList("country", countryLabel),
    region: audienceList("region"),
    placement: audienceList("publisher_platform", (value) => ({ instagram: "Instagram", facebook: "Facebook", audience_network: "Audience Network", messenger: "Messenger" })[value] ?? value),
  };

  const payload: MarketingPayload = {
    project: {
      id: selectedProject?.id ?? null,
      name: selectedProject?.name ?? "Все проекты",
      logoUrl: selectedProject?.logo_url ?? selectedSocial[0]?.profile_picture_url ?? null,
    },
    period: { from, to },
    organic: {
      connected: !hideOrganic && selectedSocial.length > 0,
      accountName: selectedSocial[0]?.username ?? selectedSocial[0]?.name ?? null,
      followers: hideOrganic ? 0 : selectedSocial.reduce((sum, account) => sum + Number(account.followers_count), 0),
      followerGrowth: hideOrganic ? 0 : organicRows.reduce((sum, row) => sum + Number(row.follower_growth), 0),
      reach: hideOrganic ? 0 : organicReach,
      impressions: hideOrganic ? 0 : organicRows.reduce((sum, row) => sum + Number(row.impressions), 0),
      engagements: hideOrganic ? 0 : organicEngagements,
      engagementRate: hideOrganic || organicReach <= 0 ? null : organicEngagements / organicReach,
      publications: hideOrganic ? 0 : posts.length,
      saves: hideOrganic ? 0 : posts.reduce((sum, post) => sum + post.saved, 0),
      posts: hideOrganic ? [] : posts,
    },
    paid: {
      connected: !hidePaid && campaignRows.length > 0,
      spend: hidePaid ? 0 : spend,
      impressions: hidePaid ? 0 : impressions,
      reach: hidePaid ? 0 : paidRows.reduce((sum, row) => sum + Number(row.reach), 0),
      clicks: hidePaid ? 0 : clicks,
      conversions: hidePaid ? 0 : conversionCount,
      conversionValue: hidePaid ? 0 : conversionValue,
      ctr: hidePaid || impressions <= 0 ? null : clicks / impressions,
      cpa: hidePaid || conversionCount <= 0 || currencies.length !== 1 ? null : spend / conversionCount,
      roas: hidePaid || spend <= 0 || currencies.length !== 1 ? null : conversionValue / spend,
      currencies,
      campaigns: hidePaid ? [] : campaignResults,
      adSets: hidePaid ? [] : detailAdSets,
      ads: hidePaid ? [] : detailAds,
      audience: hidePaid
        ? { age: [], gender: [], country: [], region: [], placement: [] }
        : audience,
    },
    daily: [...daily.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((point) => ({ ...point, organicReach: hideOrganic ? 0 : point.organicReach, paidReach: hidePaid ? 0 : point.paidReach, spend: hidePaid ? 0 : point.spend, conversions: hidePaid ? 0 : point.conversions })),
  };
  const params: AnalyticsParams = { from, to, project: projectId, channel, view };

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsShell
        payload={payload}
        initialView={view}
        params={params}
        projects={projectRows}
      />

      {accountRows.length > 0 && (
        <details className="mx-auto w-full max-w-[1500px] rounded-xl border border-neutral-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-900">Настройка Instagram-аккаунтов</summary>
          <div className="mt-4 grid gap-3">
            {accountRows.map((account) => (
              <form key={account.id} action={assignSocialAccount} className="flex flex-wrap items-center gap-3 rounded-lg bg-neutral-50 p-3">
                <input type="hidden" name="account_id" value={account.id} />
                <span className="min-w-48 text-sm font-medium text-neutral-900">@{account.username || account.name || account.id}</span>
                <Select name="project_id" defaultValue={account.project_id ?? ""} className="max-w-72"><option value="">Не привязан</option>{projectRows.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select>
                <Button type="submit" variant="outline" size="sm">Сохранить привязку</Button>
              </form>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
