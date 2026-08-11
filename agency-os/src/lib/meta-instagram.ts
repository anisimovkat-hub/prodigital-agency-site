import "server-only";

import type { InstagramPermission } from "@/lib/instagram-diagnostics";

const API_VERSION = "v23.0";
const GRAPH_URL = `https://graph.facebook.com/${API_VERSION}`;

type GraphError = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
};
type GraphPage<T> = GraphError & {
  data?: T[];
  paging?: { next?: string };
};

export type InstagramAccount = {
  externalId: string;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  followersCount: number;
  mediaCount: number;
};

export type InstagramDailyMetric = {
  date: string;
  reach: number;
  impressions: number;
  profileViews: number;
  engagements: number;
  accountsEngaged: number;
  followerCount: number;
  followerGrowth: number;
};

export type InstagramMedia = {
  externalId: string;
  caption: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  publishedAt: string;
  reach: number;
  impressions: number;
  views: number;
  likes: number;
  comments: number;
  saved: number;
  shares: number;
  engagements: number;
};

export type InstagramDiscoveryResult = {
  accounts: InstagramAccount[];
  permissions: InstagramPermission[];
  warnings: string[];
};

export type InstagramMetricResult = {
  metrics: InstagramDailyMetric[];
  failedMetrics: string[];
};

function token(): string {
  const value = process.env.META_ACCESS_TOKEN;
  if (!value) throw new Error("META_ACCESS_TOKEN не настроен в Vercel");
  return value;
}

async function graph<T>(pathOrUrl: string): Promise<T> {
  const url = pathOrUrl.startsWith("http")
    ? new URL(pathOrUrl)
    : new URL(`${GRAPH_URL}/${pathOrUrl.replace(/^\//, "")}`);
  if (!url.searchParams.has("access_token")) {
    url.searchParams.set("access_token", token());
  }
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json()) as T & GraphError;
  if (!response.ok || body.error) {
    const code = body.error?.code ? `, код ${body.error.code}` : "";
    const subcode = body.error?.error_subcode ? `/${body.error.error_subcode}` : "";
    throw new Error(`${body.error?.message || `Meta API: ${response.status}`}${code}${subcode}`);
  }
  return body;
}

async function graphAll<T>(path: string, limit = 200): Promise<T[]> {
  const rows: T[] = [];
  let next: string | undefined = path;
  while (next && rows.length < limit) {
    const page: GraphPage<T> = await graph<GraphPage<T>>(next);
    rows.push(...(page.data ?? []));
    next = page.paging?.next;
  }
  return rows.slice(0, limit);
}

async function mapInBatches<T, R>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const result: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(...await Promise.all(items.slice(index, index + size).map(worker)));
  }
  return result;
}

type FacebookPage = {
  instagram_business_account?: InstagramProfile;
};

type InstagramProfile = {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
};

type Business = { id: string };

function normalizeAccount(account: InstagramProfile): InstagramAccount {
  return {
    externalId: account.id,
    username: account.username ?? null,
    name: account.name ?? null,
    profilePictureUrl: account.profile_picture_url ?? null,
    followersCount: Number(account.followers_count ?? 0),
    mediaCount: Number(account.media_count ?? 0),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "неизвестная ошибка Meta API";
}

export async function fetchInstagramAccounts(): Promise<InstagramDiscoveryResult> {
  const fields =
    "instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}";
  const found = new Map<string, InstagramProfile>();
  const warnings: string[] = [];
  let permissions: InstagramPermission[] = [];

  try {
    permissions = await graphAll<InstagramPermission>(
      "/me/permissions?fields=permission,status&limit=200",
      200,
    );
  } catch (error) {
    warnings.push(`не удалось проверить права токена: ${errorMessage(error)}`);
  }

  try {
    const pages = await graphAll<FacebookPage>(
      `/me/accounts?fields=${encodeURIComponent(fields)}&limit=100`,
    );
    for (const page of pages) {
      const account = page.instagram_business_account;
      if (account?.id) found.set(account.id, account);
    }
  } catch (error) {
    warnings.push(`/me/accounts: ${errorMessage(error)}`);
  }

  try {
    const businesses = await graphAll<Business>("/me/businesses?fields=id&limit=100");
    for (const business of businesses) {
      const sources = await Promise.allSettled([
        graphAll<InstagramProfile>(
          `/${business.id}/owned_instagram_accounts?fields=id,username,name,profile_picture_url,followers_count,media_count&limit=100`,
        ),
        graphAll<InstagramProfile>(
          `/${business.id}/client_instagram_accounts?fields=id,username,name,profile_picture_url,followers_count,media_count&limit=100`,
        ),
      ]);
      const labels = ["owned_instagram_accounts", "client_instagram_accounts"];
      sources.forEach((source, index) => {
        if (source.status === "rejected") {
          warnings.push(`${labels[index]} (${business.id}): ${errorMessage(source.reason)}`);
          return;
        }
        for (const account of source.value) found.set(account.id, account);
      });
    }
  } catch (error) {
    warnings.push(`/me/businesses: ${errorMessage(error)}`);
  }

  return {
    accounts: [...found.values()].map(normalizeAccount),
    permissions,
    warnings: [...new Set(warnings)],
  };
}

type InsightSeriesResult = {
  points: { date: string; value: number }[];
  error: string | null;
};

function insightPoints(metric: string, insight: Insight | undefined, until: string) {
  if (!insight) return [];
  if (insight.values?.length) {
    return insight.values
      .filter((item) => item.end_time)
      .map((item) => ({
        date: item.end_time!.slice(0, 10),
        value: insightValue(metric, item.value),
      }));
  }
  const value = insightValue(metric, insight.total_value?.value);
  return value ? [{ date: until, value }] : [];
}

const TOTAL_VALUE_METRICS = new Set([
  "accounts_engaged",
  "follows_and_unfollows",
  "profile_views",
  "total_interactions",
]);

async function insightSeries(
  accountId: string,
  metric: string,
  since: string,
  until: string,
): Promise<InsightSeriesResult> {
  const queries = [
    `/${accountId}/insights?metric=${metric}&period=day&since=${since}&until=${until}`,
  ];
  if (TOTAL_VALUE_METRICS.has(metric)) {
    queries.push(
      `/${accountId}/insights?metric=${metric}&metric_type=total_value&period=day&since=${since}&until=${until}`,
    );
  }

  const errors: string[] = [];
  for (const query of queries) {
    try {
      const result = await graph<{ data?: Insight[] }>(query);
      return { points: insightPoints(metric, result.data?.[0], until), error: null };
    } catch (error) {
      errors.push(errorMessage(error));
    }
  }
  return { points: [], error: errors.at(-1) ?? "Meta не вернула метрику" };
}
type InsightValue = { value?: number | Record<string, number>; end_time?: string };
type Insight = {
  name?: string;
  values?: InsightValue[];
  total_value?: { value?: number | Record<string, number> };
};

function numericValue(value: number | Record<string, number> | undefined): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  return Object.values(value).reduce((sum, item) => sum + Number(item || 0), 0);
}

function insightValue(
  metric: string,
  value: number | Record<string, number> | undefined,
): number {
  if (metric !== "follows_and_unfollows" || typeof value !== "object" || !value) {
    return numericValue(value);
  }
  return Object.entries(value).reduce((total, [key, item]) =>
    /unfollow/i.test(key) ? total - Number(item || 0) : total + Number(item || 0), 0);
}

export async function fetchInstagramAccountMetrics(
  accountId: string,
  since: string,
  until: string,
): Promise<InstagramMetricResult> {
  const names = [
    "reach",
    "impressions",
    "profile_views",
    "total_interactions",
    "accounts_engaged",
    "follower_count",
    "follows_and_unfollows",
  ] as const;
  const series = await Promise.all(
    names.map((name) => insightSeries(accountId, name, since, until)),
  );
  const byDate = new Map<string, InstagramDailyMetric>();
  const ensure = (date: string) => {
    const existing = byDate.get(date);
    if (existing) return existing;
    const row: InstagramDailyMetric = {
      date,
      reach: 0,
      impressions: 0,
      profileViews: 0,
      engagements: 0,
      accountsEngaged: 0,
      followerCount: 0,
      followerGrowth: 0,
    };
    byDate.set(date, row);
    return row;
  };
  names.forEach((name, index) => {
    for (const point of series[index].points) {
      const row = ensure(point.date);
      if (name === "reach") row.reach = point.value;
      if (name === "impressions") row.impressions = point.value;
      if (name === "profile_views") row.profileViews = point.value;
      if (name === "total_interactions") row.engagements = point.value;
      if (name === "accounts_engaged") row.accountsEngaged = point.value;
      if (name === "follower_count") {
        row.followerCount = point.value;
        if (row.followerGrowth === 0) row.followerGrowth = point.value;
      }
      if (name === "follows_and_unfollows") row.followerGrowth = point.value;
    }
  });
  return {
    metrics: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    failedMetrics: names
      .map((name, index) => series[index].error ? `${name}: ${series[index].error}` : null)
      .filter((value): value is string => value !== null),
  };
}

type MediaBase = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
};

async function mediaInsights(media: MediaBase): Promise<Record<string, number>> {
  const metricNames = media.media_type === "VIDEO"
    ? ["reach", "saved", "shares", "total_interactions", "views"]
    : ["reach", "saved", "shares", "total_interactions", "impressions"];
  try {
    const result = await graph<{ data?: Insight[] }>(
      `/${media.id}/insights?metric=${metricNames.join(",")}`,
    );
    return Object.fromEntries(
      (result.data ?? []).map((item) => [
        item.name ?? "",
        numericValue(item.values?.[0]?.value ?? item.total_value?.value),
      ]),
    );
  } catch {
    const attempts = await Promise.allSettled(
      metricNames.map(async (metric) => {
        const result = await graph<{ data?: Insight[] }>(
          `/${media.id}/insights?metric=${metric}`,
        );
        const item = result.data?.[0];
        return [
          metric,
          numericValue(item?.values?.[0]?.value ?? item?.total_value?.value),
        ] as const;
      }),
    );
    return Object.fromEntries(
      attempts
        .filter((item): item is PromiseFulfilledResult<readonly [string, number]> => item.status === "fulfilled")
        .map((item) => item.value),
    );
  }
}

export async function fetchInstagramMedia(accountId: string): Promise<InstagramMedia[]> {
  const fields = [
    "id",
    "caption",
    "media_type",
    "media_url",
    "thumbnail_url",
    "permalink",
    "timestamp",
    "like_count",
    "comments_count",
  ].join(",");
  const media = await graphAll<MediaBase>(
    `/${accountId}/media?fields=${fields}&limit=25`,
    25,
  );
  // Ограничиваем параллелизм: у одного агентского токена может быть много аккаунтов
  // и публикаций, а резкий пакет запросов быстро упирается в лимиты Meta.
  const insights = await mapInBatches(media, 5, mediaInsights);
  return media.map((item, index) => {
    const metric = insights[index] ?? {};
    const likes = Number(item.like_count ?? 0);
    const comments = Number(item.comments_count ?? 0);
    const saved = Number(metric.saved ?? 0);
    const shares = Number(metric.shares ?? 0);
    return {
      externalId: item.id,
      caption: item.caption ?? null,
      mediaType: item.media_type ?? null,
      mediaUrl: item.media_url ?? null,
      thumbnailUrl: item.thumbnail_url ?? null,
      permalink: item.permalink ?? null,
      publishedAt: item.timestamp,
      reach: Number(metric.reach ?? 0),
      impressions: Number(metric.impressions ?? 0),
      views: Number(metric.views ?? 0),
      likes,
      comments,
      saved,
      shares,
      engagements: Number(metric.total_interactions ?? likes + comments + saved + shares),
    };
  });
}
