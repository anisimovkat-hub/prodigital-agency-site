import { AdAnalyticsPanel } from "@/app/(dashboard)/analytics/meta/ad-analytics-panel";
import type { AdTreeRow } from "@/app/(dashboard)/analytics/meta/ad-tree-table";
import type { AdsFilterValues } from "@/app/(dashboard)/analytics/meta/ads-filters";
import {
  AudienceSyncAction,
  InstagramAccountAssignment,
  type AnalyticsParams,
} from "@/app/(dashboard)/analytics/analytics-controls";
import { AnalyticsShell } from "@/app/(dashboard)/analytics/analytics-shell";
import { MediaPlanPanel } from "@/app/(dashboard)/analytics/media-plan-panel";
import { ProjectAnalyticsOverview } from "@/app/(dashboard)/analytics/project-analytics-overview";
import { YandexClientsPanel } from "@/app/(dashboard)/analytics/yandex-clients-panel";
import {
  actionTypeLabel,
  GOAL_ACTION_TYPES,
  isGoalAction,
  isGranularity,
  summarizeCampaigns,
  type ConversionRow as AdSummaryConversionRow,
  type Granularity,
  type TimeseriesPoint,
} from "@/lib/ad-analytics";
import { describeAdDataFreshness } from "@/lib/ad-data-freshness";
import type {
  MarketingAdDetail,
  MarketingAudience,
  MarketingDailyPoint,
  MarketingPayload,
  MarketingPost,
} from "@/lib/marketing-analytics";
import { calculateMediaPlanFact } from "@/lib/media-plan-fact";
import { sortProjectsForDisplay } from "@/lib/project-order";
import { marketingSection } from "@/lib/marketing-sections";
import { lastDaysPeriod } from "@/lib/analytics-period";
import { summarizeProjectAnalytics } from "@/lib/project-analytics-summary";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

type SearchParams = {
  from?: string;
  to?: string;
  project?: string;
  social?: string;
  section?: string;
  view?: string;
  gran?: string;
  account?: string;
  campaign?: string;
  goal?: string;
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const defaultPeriod = lastDaysPeriod(new Date(), 7);
  const from = raw.from && ISO_DATE.test(raw.from) ? raw.from : defaultPeriod.from;
  const to = raw.to && ISO_DATE.test(raw.to) ? raw.to : defaultPeriod.to;
  let projectId = raw.project && UUID.test(raw.project) ? raw.project : "";
  let socialId = raw.social ?? "";
  const section = marketingSection(raw.section, raw.view);
  const granularity: Granularity = isGranularity(raw.gran) ? raw.gran : "day";
  const accountFilter = raw.account ?? "";
  const campaignFilter = raw.campaign ?? "";
  const goalFilter = raw.goal ?? "";

  const [
    projectsResult,
    socialAccountsResult,
    campaignsResult,
    adAccountsResult,
    adSetsResult,
    adsResult,
    customConversionsResult,
    mediaPlansResult,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id,name,logo_url,stage")
      .in("stage", ["launching", "active"]),
    supabase
      .from("social_accounts")
      .select("id,project_id,username,name,profile_picture_url,followers_count,last_synced_at")
      .eq("platform", "instagram")
      .order("name"),
    supabase.from("ad_campaigns").select("id,name,objective,status,project_id,ad_account_id"),
    supabase.from("ad_accounts").select("id,name,external_id,project_id,currency").eq("platform", "meta"),
    supabase.from("ad_sets").select("id,name,status,campaign_id"),
    supabase.from("ads").select("id,name,status,adset_id"),
    supabase.from("ad_custom_conversions").select("conversion_id,name"),
    projectId
      ? supabase
          .from("media_plans")
          .select("id,project_id,workstream,period_start,period_end,name,status,currency,source_type,updated_at")
          .eq("project_id", projectId)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const { data: projects } = projectsResult;
  const { data: socialAccounts } = socialAccountsResult;
  const { data: campaigns } = campaignsResult;
  const { data: adAccounts } = adAccountsResult;
  const { data: adSets } = adSetsResult;
  const { data: ads } = adsResult;
  const { data: customConversions } = customConversionsResult;
  let mediaPlans = mediaPlansResult.data ?? [];
  const dataWarnings = [
    ["проекты", projectsResult.error],
    ["Instagram-аккаунты", socialAccountsResult.error],
    ["кампании", campaignsResult.error],
    ["рекламные кабинеты", adAccountsResult.error],
    ["группы объявлений", adSetsResult.error],
    ["объявления", adsResult.error],
    ["названия конверсий", customConversionsResult.error],
    ["медиапланы", mediaPlansResult.error],
  ].flatMap(([label, error]) => error && typeof error !== "string"
    ? [`Не удалось загрузить ${label}: ${error.message}`]
    : []);

  const projectRows = sortProjectsForDisplay(projects ?? []);
  const currentProjectIds = new Set(projectRows.map((project) => project.id));
  if (projectId && !currentProjectIds.has(projectId)) projectId = "";
  if (!projectId) mediaPlans = [];
  const accountRows = (socialAccounts ?? []).filter(
    (account) => !account.project_id || currentProjectIds.has(account.project_id),
  );
  if (socialId && !accountRows.some((account) => account.id === socialId)) {
    socialId = "";
  }
  const selectedSocial = accountRows.filter(
    (account) =>
      (!projectId || account.project_id === projectId) &&
      (!socialId || account.id === socialId),
  );
  const socialIds = selectedSocial.map((account) => account.id);
  const allCampaignRows = (campaigns ?? []).filter(
    (campaign) => !campaign.project_id || currentProjectIds.has(campaign.project_id),
  );
  const currentAdAccountRows = (adAccounts ?? []).filter(
    (account) => !account.project_id || currentProjectIds.has(account.project_id),
  );
  const campaignRows = allCampaignRows.filter((campaign) => !projectId || campaign.project_id === projectId);
  const campaignIds = new Set(campaignRows.map((campaign) => campaign.id));
  const campaignIdList = [...campaignIds];
  const approvedPlans = mediaPlans.filter((plan) => plan.status === "approved");
  const activePlansByScope = new Map<string, (typeof approvedPlans)[number]>();
  for (const plan of approvedPlans
    .filter((plan) => plan.period_start <= to && plan.period_end >= from)
    .sort((a, b) => {
      const exactA = a.period_start === from && a.period_end === to ? 0 : 1;
      const exactB = b.period_start === from && b.period_end === to ? 0 : 1;
      return exactA - exactB || b.updated_at.localeCompare(a.updated_at);
    })) {
    const key = `${plan.currency}\u0000${plan.workstream ?? ""}`;
    if (!activePlansByScope.has(key)) activePlansByScope.set(key, plan);
  }
  const activePlans = [...activePlansByScope.values()];
  const activePlanIds = activePlans.map((plan) => plan.id);
  const activePlanMetricsPromise = activePlanIds.length
    ? supabase
        .from("media_plan_metrics")
        .select("id,media_plan_id,metric_key,label,target_value,unit,conversion_action_type,campaign_id,sort_order,notes")
        .in("media_plan_id", activePlanIds)
        .order("sort_order")
    : Promise.resolve({ data: [], error: null });
  const earliestPlanStart = activePlans.reduce<string | null>((min, plan) => !min || plan.period_start < min ? plan.period_start : min, null);
  const latestPlanEnd = activePlans.reduce<string | null>((max, plan) => !max || plan.period_end > max ? plan.period_end : max, null);
  const planMetricsFactPromise = activePlans.length && campaignIdList.length
    ? supabase
        .from("ad_campaign_metrics")
        .select("campaign_id,date,spend,impressions,clicks,reach")
        .in("campaign_id", campaignIdList)
        .gte("date", earliestPlanStart!)
        .lte("date", latestPlanEnd!)
        .range(0, 19999)
    : Promise.resolve({ data: [], error: null });
  const planConversionsFactPromise = activePlans.length && campaignIdList.length
    ? supabase
        .from("ad_conversions")
        .select("campaign_id,date,action_type,count,value")
        .in("campaign_id", campaignIdList)
        .gte("date", earliestPlanStart!)
        .lte("date", latestPlanEnd!)
        .range(0, 19999)
    : Promise.resolve({ data: [], error: null });

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
  const paidMetricsQuery = supabase
    .from("ad_campaign_metrics")
    .select("campaign_id,date,spend,impressions,clicks,reach")
    .gte("date", from)
    .lte("date", to);
  const conversionsQuery = supabase
    .from("ad_conversions")
    .select("campaign_id,date,action_type,count,value")
    .gte("date", from)
    .lte("date", to);
  const audienceQuery = supabase
    .from("ad_audience_metrics")
    .select("campaign_id,breakdown,value,impressions,reach")
    .gte("date", from)
    .lte("date", to);
  const paidMetricsPromise = projectId
    ? campaignIdList.length
      ? paidMetricsQuery.in("campaign_id", campaignIdList).range(0, 9999)
      : Promise.resolve({ data: [] as CampaignMetricRow[], error: null })
    : paidMetricsQuery.range(0, 9999);
  const conversionsPromise = projectId
    ? campaignIdList.length
      ? conversionsQuery.in("campaign_id", campaignIdList).range(0, 19999)
      : Promise.resolve({ data: [] as ConversionRow[], error: null })
    : conversionsQuery.range(0, 19999);
  const audiencePromise = projectId
    ? campaignIdList.length
      ? audienceQuery.in("campaign_id", campaignIdList).range(0, 19999)
      : Promise.resolve({ data: [] as AudienceRow[], error: null })
    : audienceQuery.range(0, 19999);
  const latestPaidMetricPromise = campaignIdList.length
    ? supabase
        .from("ad_campaign_metrics")
        .select("date")
        .in("campaign_id", campaignIdList)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null as { date: string } | null, error: null });

  const [
    socialMetricsResult,
    socialPostsResult,
    paidMetricsResult,
    conversionsResult,
    campaignSummaryResult,
    adSetSummaryResult,
    adSummaryResult,
    audienceMetricsResult,
    adTimeseriesResult,
    latestPaidMetricResult,
    activePlanMetricsResult,
    planMetricsFactResult,
    planConversionsFactResult,
  ] = await Promise.all([
    socialMetricsPromise,
    socialPostsPromise,
    paidMetricsPromise,
    conversionsPromise,
    supabase.rpc("ad_campaign_period_summary", { p_since: from, p_until: to }),
    supabase.rpc("ad_set_period_summary", { p_since: from, p_until: to }),
    supabase.rpc("ad_ad_period_summary", { p_since: from, p_until: to }),
    audiencePromise,
    supabase.rpc("ad_timeseries", {
      p_since: from,
      p_until: to,
      p_granularity: granularity,
      p_project_id: projectId || null,
      p_account_id: accountFilter || null,
      p_campaign_id: campaignFilter || null,
      p_action_type: goalFilter || null,
    }),
    latestPaidMetricPromise,
    activePlanMetricsPromise,
    planMetricsFactPromise,
    planConversionsFactPromise,
  ]);
  const { data: socialMetrics } = socialMetricsResult;
  const { data: socialPosts } = socialPostsResult;
  const { data: paidMetrics } = paidMetricsResult;
  const { data: conversions } = conversionsResult;
  const { data: campaignSummary } = campaignSummaryResult;
  const { data: adSetSummary } = adSetSummaryResult;
  const { data: adSummary } = adSummaryResult;
  const { data: audienceMetrics } = audienceMetricsResult;
  const { data: adTimeseries } = adTimeseriesResult;
  const { data: latestPaidMetric } = latestPaidMetricResult;
  dataWarnings.push(...[
    ["метрики Instagram", socialMetricsResult.error],
    ["публикации Instagram", socialPostsResult.error],
    ["метрики кампаний", paidMetricsResult.error],
    ["конверсии", conversionsResult.error],
    ["сводку кампаний", campaignSummaryResult.error],
    ["сводку групп объявлений", adSetSummaryResult.error],
    ["сводку объявлений", adSummaryResult.error],
    ["аудиторию", audienceMetricsResult.error],
    ["график рекламы", adTimeseriesResult.error],
    ["дату последнего обновления рекламы", latestPaidMetricResult.error],
    ["метрики медиаплана", activePlanMetricsResult.error],
    ["факт медиаплана", planMetricsFactResult.error || planConversionsFactResult.error],
  ].flatMap(([label, error]) => error && typeof error !== "string"
    ? [`Не удалось загрузить ${label}: ${error.message}`]
    : []));

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
  const currencies = [...new Set(currentAdAccountRows.filter((account) => campaignAccountIds.has(account.id) && account.currency).map((account) => account.currency!))];
  const selectedProject = projectRows.find((project) => project.id === projectId);
  const mediaPlanFacts = activePlans.map((plan) => ({
    plan,
    rows: calculateMediaPlanFact({
      projectId: plan.project_id,
      currency: plan.currency,
      metrics: (activePlanMetricsResult.data ?? [])
        .filter((metric) => metric.media_plan_id === plan.id)
        .map((metric) => ({
          ...metric,
          target_value: Number(metric.target_value),
          unit: metric.unit as "money" | "count" | "percent",
        })),
      campaigns: campaignRows,
      accounts: currentAdAccountRows,
      campaignMetrics: (planMetricsFactResult.data ?? []).filter(
        (row) => row.date >= plan.period_start && row.date <= plan.period_end,
      ),
      conversions: (planConversionsFactResult.data ?? []).filter(
        (row) => row.date >= plan.period_start && row.date <= plan.period_end,
      ),
    }),
  }));

  const customNames = new Map(
    (customConversions ?? [])
      .filter((conversion) => conversion.name)
      .map((conversion) => [conversion.conversion_id, conversion.name!]),
  );
  const accountCurrency = new Map(
    currentAdAccountRows.map((account) => [account.id, account.currency]),
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
      connected: selectedSocial.length > 0,
      accountName: selectedSocial[0]?.username ?? selectedSocial[0]?.name ?? null,
      followers: selectedSocial.reduce((sum, account) => sum + Number(account.followers_count), 0),
      followerGrowth: organicRows.reduce((sum, row) => sum + Number(row.follower_growth), 0),
      reach: organicReach,
      impressions: organicRows.reduce((sum, row) => sum + Number(row.impressions), 0),
      engagements: organicEngagements,
      engagementRate: organicReach <= 0 ? null : organicEngagements / organicReach,
      publications: posts.length,
      saves: posts.reduce((sum, post) => sum + post.saved, 0),
      posts,
    },
    paid: {
      connected: campaignRows.length > 0,
      spend,
      impressions,
      reach: paidRows.reduce((sum, row) => sum + Number(row.reach), 0),
      clicks,
      conversions: conversionCount,
      conversionValue,
      ctr: impressions <= 0 ? null : clicks / impressions,
      cpa: conversionCount <= 0 || currencies.length !== 1 ? null : spend / conversionCount,
      roas: spend <= 0 || currencies.length !== 1 ? null : conversionValue / spend,
      currencies,
      campaigns: campaignResults,
      adSets: detailAdSets,
      ads: detailAds,
      audience,
    },
    daily: [...daily.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((point) => ({ ...point })),
  };

  const portfolioSummary = !projectId
    ? summarizeProjectAnalytics({
        projects: projectRows,
        campaigns: allCampaignRows,
        accounts: currentAdAccountRows,
        metrics: (paidMetrics ?? []) as CampaignMetricRow[],
        conversions: (conversions ?? []) as ConversionRow[],
      })
    : null;

  const goalCampaignIds = new Set(
    allCampaignRows
      .filter(
        (campaign) =>
          (!projectId || campaign.project_id === projectId) &&
          (!accountFilter || campaign.ad_account_id === accountFilter) &&
          (!campaignFilter || campaign.id === campaignFilter),
      )
      .map((campaign) => campaign.id),
  );
  const conversionLabels = new Set<string>();
  for (const conversion of allGoalConversions) {
    if (goalCampaignIds.has(conversion.campaign_id)) {
      conversionLabels.add(conversion.action_type);
    }
  }
  const goalOptions = [...conversionLabels]
    .map((value) => ({ value, label: actionTypeLabel(value, customNames) }))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));

  const filteredCampaigns = allCampaignRows.filter(
    (campaign) =>
      (!projectId || campaign.project_id === projectId) &&
      (!accountFilter || campaign.ad_account_id === accountFilter) &&
      (!campaignFilter || campaign.id === campaignFilter),
  );
  const filteredCampaignIds = new Set(filteredCampaigns.map((campaign) => campaign.id));
  const adSetsByCampaign = new Map<string, typeof adSets>();
  for (const adSet of adSets ?? []) {
    const rows = adSetsByCampaign.get(adSet.campaign_id) ?? [];
    rows.push(adSet);
    adSetsByCampaign.set(adSet.campaign_id, rows);
  }
  const adsByAdSet = new Map<string, typeof ads>();
  for (const ad of ads ?? []) {
    const rows = adsByAdSet.get(ad.adset_id) ?? [];
    rows.push(ad);
    adsByAdSet.set(ad.adset_id, rows);
  }
  const adAccountCurrency = new Map(currentAdAccountRows.map((account) => [account.id, account.currency]));
  const buildTreeRow = (
    id: string,
    name: string | null,
    status: string | null,
    level: number,
    summary: NonNullable<ReturnType<typeof campaignSummaries.get>>,
    currency: string | null,
    children: AdTreeRow[],
  ): AdTreeRow => ({
    id,
    name: name ?? "Без названия",
    status,
    level,
    spend: summary.spend,
    impressions: summary.impressions,
    clicks: summary.clicks,
    ctr: summary.ctr,
    cpc: summary.cpc,
    cpm: summary.cpm,
    results: summary.primaryGoal?.count ?? null,
    goalLabel: summary.primaryGoal ? actionTypeLabel(summary.primaryGoal.actionType, customNames) : null,
    cpa: summary.cpa,
    currency,
    children,
  });
  const bySpend = (a: AdTreeRow, b: AdTreeRow) => b.spend - a.spend;
  const adTree: AdTreeRow[] = filteredCampaigns
    .flatMap((campaign) => {
      const summary = campaignSummaries.get(campaign.id);
      if (!summary) return [];
      const currency = adAccountCurrency.get(campaign.ad_account_id) ?? null;
      const children = (adSetsByCampaign.get(campaign.id) ?? [])
        .flatMap((adSet) => {
          const adSetSummary = adSetSummaries.get(adSet.id);
          if (!adSetSummary) return [];
          const adChildren = (adsByAdSet.get(adSet.id) ?? [])
            .flatMap((ad) => {
              const adSummaryRow = adSummaries.get(ad.id);
              return adSummaryRow
                ? [buildTreeRow(ad.id, ad.name, ad.status, 2, adSummaryRow, currency, [])]
                : [];
            })
            .sort(bySpend);
          return [buildTreeRow(adSet.id, adSet.name, adSet.status, 1, adSetSummary, currency, adChildren)];
        })
        .sort(bySpend);
      return [buildTreeRow(campaign.id, campaign.name, campaign.status, 0, summary, currency, children)];
    })
    .filter((row) => filteredCampaignIds.has(row.id))
    .sort(bySpend);

  const relevantAccounts = campaignFilter
    ? currentAdAccountRows.filter((account) => account.id === allCampaignRows.find((campaign) => campaign.id === campaignFilter)?.ad_account_id)
    : accountFilter
      ? currentAdAccountRows.filter((account) => account.id === accountFilter)
      : projectId
        ? currentAdAccountRows.filter((account) => account.project_id === projectId)
        : currentAdAccountRows;
  const detailCurrencies = [...new Set(relevantAccounts.map((account) => account.currency).filter((value): value is string => !!value))];
  const detailCurrency = detailCurrencies.length === 1 ? detailCurrencies[0] : null;
  const currentAdsFilters: AdsFilterValues = {
    from,
    to,
    gran: granularity,
    project: projectId,
    account: accountFilter,
    campaign: campaignFilter,
    goal: goalFilter,
  };
  const params: AnalyticsParams = { from, to, project: projectId, social: socialId, section };
  const freshnessWarning = describeAdDataFreshness({
    latestDate: latestPaidMetric?.date ?? null,
    from,
    to,
  });

  const contentSettings = accountRows.length > 0 ? (
    <details className="rounded-xl border border-neutral-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-neutral-900">Настройка Instagram-аккаунтов</summary>
      <div className="mt-4 grid gap-3">
        {accountRows.map((account) => (
          <InstagramAccountAssignment
            key={account.id}
            account={{
              id: account.id,
              projectId: account.project_id,
              label: `@${account.username || account.name || account.id}`,
              details: [
                `${Number(account.followers_count).toLocaleString("ru-RU")} подписчиков`,
                account.last_synced_at
                  ? `обновлено ${new Date(account.last_synced_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}`
                  : "insights ещё не загружены",
              ].join(" · "),
            }}
            projects={projectRows}
          />
        ))}
      </div>
    </details>
  ) : null;

  return (
    <AnalyticsShell
      payload={payload}
      initialSection={section}
      params={params}
      projects={projectRows}
      socialAccounts={accountRows.map((account) => ({
        id: account.id,
        project_id: account.project_id,
        name: `@${account.username || account.name || account.id}`,
      }))}
      contentSettings={contentSettings}
      dataWarnings={dataWarnings}
      portfolioOverview={portfolioSummary ? (
        <ProjectAnalyticsOverview rows={portfolioSummary} from={from} to={to} />
      ) : undefined}
      mediaPlan={
        <MediaPlanPanel
          projectId={projectId || null}
          from={from}
          to={to}
          currencies={currencies}
          campaigns={campaignRows.map((campaign) => ({
            id: campaign.id,
            name: campaign.name ?? "Кампания без названия",
            currency: accountCurrency.get(campaign.ad_account_id) ?? null,
          }))}
          plans={mediaPlans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            workstream: plan.workstream,
            period_start: plan.period_start,
            period_end: plan.period_end,
            currency: plan.currency,
            status: plan.status as "draft" | "approved" | "archived",
            source_type: plan.source_type as "manual" | "google_sheets",
          }))}
          activePlans={mediaPlanFacts.map(({ plan, rows }) => ({
            plan: {
              id: plan.id,
              name: plan.name,
              workstream: plan.workstream,
              period_start: plan.period_start,
              period_end: plan.period_end,
              currency: plan.currency,
            },
            rows,
          }))}
        />
      }
      adsPanel={
        <>
          <YandexClientsPanel />
          <AdAnalyticsPanel
            current={currentAdsFilters}
            accounts={currentAdAccountRows.map((account) => ({
              id: account.id,
              name: account.name ?? account.external_id,
              project_id: account.project_id,
            }))}
            campaigns={allCampaignRows.map((campaign) => ({
              id: campaign.id,
              name: campaign.name ?? "Без названия",
              project_id: campaign.project_id,
              account_id: campaign.ad_account_id,
            }))}
            goals={goalOptions}
            points={(adTimeseries ?? []) as TimeseriesPoint[]}
            granularity={granularity}
            currency={detailCurrency}
            currencies={detailCurrencies}
            goalLabel={goalFilter ? actionTypeLabel(goalFilter, customNames) : null}
            tree={adTree}
            audience={audience}
            audienceActions={<AudienceSyncAction projectId={projectId} />}
            freshnessWarning={freshnessWarning}
          />
        </>
      }
    />
  );
}
