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

type InsightBatchResult = {
  series: Map<string, { date: string; value: number }[]>;
  failedMetrics: string[];
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
  if (metric !== "follows_and_unfollows") {
    // Meta изредка возвращает отрицательный технический счётчик. Для накопительных
    // метрик он не имеет бизнес-смысла и не должен нарушать CHECK >= 0 в БД.
    return Math.max(0, numericValue(value));
  }
  if (typeof value !== "object" || !value) {
    return numericValue(value);
  }
  return Object.entries(value).reduce((total, [key, item]) =>
    /unfollow/i.test(key) ? total - Number(item || 0) : total + Number(item || 0), 0);
}

async function insightBatch(
  accountId: string,
  metrics: readonly string[],
  since: string,
  until: string,
  totalValue = false,
): Promise<InsightBatchResult> {
  const metricType = totalValue ? "&metric_type=total_value" : "";
  try {
    const result = await graph<{ data?: Insight[] }>(
      `/${accountId}/insights?metric=${metrics.join(",")}${metricType}&period=day&since=${since}&until=${until}`,
    );
    const byName = new Map((result.data ?? []).map((item) => [item.name, item]));
    return {
      series: new Map(metrics.map((metric) => [
        metric,
        insightPoints(metric, byName.get(metric), until),
      ])),
      failedMetrics: metrics
        .filter((metric) => !byName.has(metric))
        .map((metric) => `${metric}: Meta не вернула метрику`),
    };
  } catch {
    // Один недоступный показатель не должен обнулять весь аккаунт. Редкий
    // fallback остаётся точечным, а штатный путь делает один запрос на группу.
    const fallback = await Promise.all(
      metrics.map((metric) => insightSeries(accountId, metric, since, until)),
    );
    return {
      series: new Map(metrics.map((metric, index) => [metric, fallback[index].points])),
      failedMetrics: metrics
        .map((metric, index) => fallback[index].error
          ? `${metric}: ${fallback[index].error}`
          : null)
        .filter((value): value is string => value !== null),
    };
  }
}

export async function fetchInstagramAccountMetrics(
  accountId: string,
  since: string,
  until: string,
): Promise<InstagramMetricResult> {
  // Meta больше не отдаёт account-level impressions. Дневные ряды и итоговые
  // показатели запрашиваются двумя пакетами вместо семи отдельных запросов.
  const dailyNames = ["reach", "follower_count"] as const;
  const totalNames = [
    "profile_views",
    "total_interactions",
    "accounts_engaged",
    "follows_and_unfollows",
  ] as const;
  const [dailyBatch, totalBatch] = await Promise.all([
    insightBatch(accountId, dailyNames, since, until),
    insightBatch(accountId, totalNames, since, until, true),
  ]);
  const series = new Map([...dailyBatch.series, ...totalBatch.series]);
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
  [...dailyNames, ...totalNames].forEach((name) => {
    for (const point of series.get(name) ?? []) {
      const row = ensure(point.date);
      if (name === "reach") row.reach = point.value;
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
    failedMetrics: [...dailyBatch.failedMetrics, ...totalBatch.failedMetrics],
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
  insights?: { data?: Insight[] };
};

export async function fetchInstagramMedia(accountId: string): Promise<InstagramMedia[]> {
  const baseFields = [
    "id",
    "caption",
    "media_type",
    "media_url",
    "thumbnail_url",
    "permalink",
    "timestamp",
    "like_count",
    "comments_count",
  ];
  const fields = [
    ...baseFields,
    "insights.metric(reach,saved,shares,total_interactions,views)",
  ].join(",");
  let media: MediaBase[];
  try {
    // Field expansion возвращает публикацию и её insights одним запросом вместо
    // 25 отдельных запросов — это критично для агентского портфеля аккаунтов.
    media = await graphAll<MediaBase>(
      `/${accountId}/media?fields=${encodeURIComponent(fields)}&limit=25`,
      25,
    );
  } catch {
    const fallbackFields = baseFields.join(",");
    media = await graphAll<MediaBase>(
      `/${accountId}/media?fields=${encodeURIComponent(fallbackFields)}&limit=25`,
      25,
    );
  }
  return media.map((item) => {
    const metric = Object.fromEntries(
      (item.insights?.data ?? []).map((insight) => [
        insight.name ?? "",
        numericValue(insight.values?.[0]?.value ?? insight.total_value?.value),
      ]),
    );
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
      impressions: 0,
      views: Number(metric.views ?? 0),
      likes,
      comments,
      saved,
      shares,
      engagements: Number(metric.total_interactions ?? likes + comments + saved + shares),
    };
  });
}
