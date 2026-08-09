import { assignSocialAccount } from "@/app/(dashboard)/analytics/actions";
import {
  AnalyticsActions,
  AnalyticsFilters,
  type AnalyticsParams,
} from "@/app/(dashboard)/analytics/analytics-controls";
import {
  MarketingDashboard,
  type MarketingView,
} from "@/components/marketing-dashboard";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { GOAL_ACTION_TYPES } from "@/lib/ad-analytics";
import type {
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
  ] = await Promise.all([
    supabase.from("projects").select("id,name,logo_url").order("name"),
    supabase
      .from("social_accounts")
      .select("id,project_id,username,name,profile_picture_url,followers_count,last_synced_at")
      .eq("platform", "instagram")
      .order("name"),
    supabase.from("ad_campaigns").select("id,project_id,ad_account_id"),
    supabase.from("ad_accounts").select("id,project_id,currency"),
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
        .range(0, 999)
    : Promise.resolve({ data: [], error: null });

  const [
    { data: socialMetrics },
    { data: socialPosts },
    { data: paidMetrics },
    { data: conversions },
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
      .in("action_type", [...GOAL_ACTION_TYPES])
      .gte("date", from)
      .lte("date", to)
      .range(0, 9999),
  ]);

  const organicRows = (socialMetrics ?? []) as SocialMetricRow[];
  const paidRows = ((paidMetrics ?? []) as CampaignMetricRow[]).filter((row) => campaignIds.has(row.campaign_id));
  const conversionRows = primaryConversions(
    ((conversions ?? []) as ConversionRow[]).filter((row) => campaignIds.has(row.campaign_id)),
  );
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
    },
    daily: [...daily.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((point) => ({ ...point, organicReach: hideOrganic ? 0 : point.organicReach, paidReach: hidePaid ? 0 : point.paidReach, spend: hidePaid ? 0 : point.spend, conversions: hidePaid ? 0 : point.conversions })),
  };
  const params: AnalyticsParams = { from, to, project: projectId, channel, view };

  return (
    <div className="flex flex-col gap-6">
      <MarketingDashboard
        payload={payload}
        view={view}
        controls={<AnalyticsActions projectId={projectId} />}
        filters={<AnalyticsFilters params={params} projects={projectRows} />}
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
