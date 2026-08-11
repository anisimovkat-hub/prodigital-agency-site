"use server";

import { revalidatePath } from "next/cache";

import {
  fetchInstagramAccountMetrics,
  fetchInstagramAccounts,
  fetchInstagramMedia,
} from "@/lib/meta-instagram";
import { fetchMetaAudienceInsights } from "@/lib/meta-ads";
import {
  compactInstagramErrors,
  instagramPermissionHint,
} from "@/lib/instagram-diagnostics";
import { createClient } from "@/lib/supabase/server";

export type AnalyticsActionState =
  | { ok: boolean; message: string; url?: string }
  | undefined;

const AUDIENCE_BREAKDOWN_LABELS: Record<string, string> = {
  age: "возраст",
  gender: "пол",
  country: "страны",
  region: "регионы",
  publisher_platform: "площадки",
};

function compactAudienceError(message: string): string {
  if (message.includes("ads_management") || message.includes("ads_read")) {
    return "у владельца кабинета нет права ads_read";
  }
  return message.replace(/https?:\/\/\S+/g, "").trim().slice(0, 180);
}

const GENERIC_TOKENS = new Set(["ads", "account", "new", "the", "com", "lab", "asia"]);
function matchProjectId(
  account: { username: string | null; name: string | null },
  projects: { id: string; name: string }[],
): string | null {
  const haystack = `${account.username ?? ""} ${account.name ?? ""}`.toLocaleLowerCase("ru-RU");
  for (const project of projects) {
    const tokens = project.name
      .toLocaleLowerCase("ru-RU")
      .split(/[^a-zа-я0-9]+/i)
      .filter((part) => part.length >= 3 && !GENERIC_TOKENS.has(part));
    if (tokens.some((part) => haystack.includes(part))) return project.id;
  }
  return null;
}

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function settleInBatches<T, R>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const result: PromiseSettledResult<R>[] = [];
  for (const batch of chunk(items, size)) {
    result.push(...await Promise.allSettled(batch.map(worker)));
  }
  return result;
}

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Нет авторизации. Войдите снова.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "owner") throw new Error("Недостаточно прав.");
  return supabase;
}

export async function syncInstagramAnalytics(
  _prevState: AnalyticsActionState,
): Promise<AnalyticsActionState> {
  void _prevState;
  try {
    const supabase = await requireOwner();
    const discovery = await fetchInstagramAccounts();
    const accounts = discovery.accounts;
    if (accounts.length === 0) {
      const details = [
        instagramPermissionHint(discovery.permissions),
        discovery.warnings.length ? compactInstagramErrors(discovery.warnings) : null,
      ].filter((value): value is string => Boolean(value));
      return {
        ok: false,
        message:
          `Instagram-аккаунты не найдены.${details.length ? ` ${details.join(". ")}.` : " Проверьте права токена и назначение Instagram-аккаунтов приложению Meta."}`,
      };
    }

    const { data: projects } = await supabase.from("projects").select("id,name");
    const projectRows = projects ?? [];
    const now = new Date().toISOString();
    const { data: savedAccounts, error: accountError } = await supabase
      .from("social_accounts")
      .upsert(
        accounts.map((account) => ({
          platform: "instagram" as const,
          external_id: account.externalId,
          username: account.username,
          name: account.name,
          profile_picture_url: account.profilePictureUrl,
          followers_count: account.followersCount,
          media_count: account.mediaCount,
        })),
        { onConflict: "platform,external_id" },
      )
      .select("id,external_id,username,name,project_id,followers_count");
    if (accountError) throw new Error(accountError.message);

    const rows = savedAccounts ?? [];
    for (const row of rows) {
      if (row.project_id) continue;
      const projectId = matchProjectId(row, projectRows);
      if (projectId) {
        await supabase.from("social_accounts").update({ project_id: projectId }).eq("id", row.id);
        row.project_id = projectId;
      }
    }

    const since = isoDaysAgo(90);
    const until = isoDaysAgo(0);
    const results = await settleInBatches(
      rows,
      3,
      async (row) => {
        const label = `@${row.username || row.name || row.external_id}`;
        const [metricsResult, mediaResult] = await Promise.allSettled([
          fetchInstagramAccountMetrics(row.external_id, since, until),
          fetchInstagramMedia(row.external_id),
        ]);
        const daily = metricsResult.status === "fulfilled" ? metricsResult.value.metrics : [];
        const media = mediaResult.status === "fulfilled" ? mediaResult.value : [];
        const warnings = [
          ...(metricsResult.status === "fulfilled" ? metricsResult.value.failedMetrics : []),
          ...(metricsResult.status === "rejected" ? [`insights: ${metricsResult.reason instanceof Error ? metricsResult.reason.message : "ошибка Meta API"}`] : []),
          ...(mediaResult.status === "rejected" ? [`публикации: ${mediaResult.reason instanceof Error ? mediaResult.reason.message : "ошибка Meta API"}`] : []),
        ];
        if (metricsResult.status === "rejected" && mediaResult.status === "rejected") {
          throw new Error(`${label}: ${compactInstagramErrors(warnings)}`);
        }
        if (daily.length) {
          const { error } = await supabase.from("social_account_metrics").upsert(
            daily.map((metric) => ({
              social_account_id: row.id,
              date: metric.date,
              reach: metric.reach,
              impressions: metric.impressions,
              profile_views: metric.profileViews,
              engagements: metric.engagements,
              accounts_engaged: metric.accountsEngaged,
              follower_count: metric.followerCount || row.followers_count,
              follower_growth: metric.followerGrowth,
            })),
            { onConflict: "social_account_id,date" },
          );
          if (error) throw new Error(error.message);
        }
        if (media.length) {
          const { error } = await supabase.from("social_posts").upsert(
            media.map((post) => ({
              social_account_id: row.id,
              external_id: post.externalId,
              caption: post.caption,
              media_type: post.mediaType,
              media_url: post.mediaUrl,
              thumbnail_url: post.thumbnailUrl,
              permalink: post.permalink,
              published_at: post.publishedAt,
              reach: post.reach,
              impressions: post.impressions,
              views: post.views,
              likes: post.likes,
              comments: post.comments,
              saved: post.saved,
              shares: post.shares,
              engagements: post.engagements,
              last_synced_at: now,
            })),
            { onConflict: "social_account_id,external_id" },
          );
          if (error) throw new Error(error.message);
        }
        if (daily.length || media.length || warnings.length === 0) {
          const { error } = await supabase
            .from("social_accounts")
            .update({ last_synced_at: now })
            .eq("id", row.id);
          if (error) throw new Error(error.message);
        }
        return { label, daily: daily.length, posts: media.length, warnings };
      },
    );

    const successful = results.filter((result) => result.status === "fulfilled");
    const dailyCount = successful.reduce(
      (sum, result) => sum + (result.status === "fulfilled" ? result.value.daily : 0),
      0,
    );
    const postCount = successful.reduce(
      (sum, result) => sum + (result.status === "fulfilled" ? result.value.posts : 0),
      0,
    );
    const failed = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason instanceof Error ? result.reason.message : "неизвестная ошибка аккаунта");
    const partial = successful.flatMap((result) =>
      result.status === "fulfilled" && result.value.warnings.length
        ? [`${result.value.label}: ${compactInstagramErrors(result.value.warnings)}`]
        : [],
    );
    const discoveryWarnings = discovery.warnings.length
      ? [`поиск аккаунтов: ${compactInstagramErrors(discovery.warnings)}`]
      : [];
    const problems = [...failed, ...partial, ...discoveryWarnings];
    revalidatePath("/analytics");
    const hasAnalytics = dailyCount > 0 || postCount > 0;
    return {
      ok: hasAnalytics,
      message: [
        `Instagram: найдено ${accounts.length} аккаунтов, загружено ${dailyCount} дней и ${postCount} публикаций.`,
        problems.length ? `Проблемы: ${compactInstagramErrors(problems)}.` : null,
        !hasAnalytics && !problems.length
          ? "Meta вернула профили, но не вернула insights за выбранный период."
          : null,
      ].filter(Boolean).join(" "),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Не удалось обновить Instagram.",
    };
  }
}

export async function syncMetaAudienceAnalytics(
  _prevState: AnalyticsActionState,
  formData: FormData,
): Promise<AnalyticsActionState> {
  void _prevState;
  try {
    const supabase = await requireOwner();
    const projectId = String(formData.get("project_id") ?? "");
    let accountsQuery = supabase
      .from("ad_accounts")
      .select("id,external_id,name")
      .eq("platform", "meta");
    let campaignsQuery = supabase
      .from("ad_campaigns")
      .select("id,external_id,ad_account_id");
    if (projectId) {
      accountsQuery = accountsQuery.eq("project_id", projectId);
      campaignsQuery = campaignsQuery.eq("project_id", projectId);
    }
    const [{ data: accounts, error: accountsError }, { data: campaigns, error: campaignsError }] =
      await Promise.all([
        accountsQuery,
        campaignsQuery,
      ]);
    if (accountsError) throw new Error(accountsError.message);
    if (campaignsError) throw new Error(campaignsError.message);
    if (!accounts?.length) {
      return { ok: false, message: "Сначала обновите основную статистику Meta." };
    }

    const since = isoDaysAgo(30);
    const until = isoDaysAgo(0);
    const results = await Promise.allSettled(
      accounts.map(async (account) => ({
        account,
        insights: await fetchMetaAudienceInsights(account.external_id, since, until),
      })),
    );
    const campaignByExternal = new Map(
      (campaigns ?? []).map((campaign) => [
        `${campaign.ad_account_id}:${campaign.external_id}`,
        campaign.id,
      ]),
    );
    const rows = results.flatMap((result) => {
      if (result.status !== "fulfilled") return [];
      return result.value.insights.metrics.flatMap((metric) => {
        const campaignId = campaignByExternal.get(
          `${result.value.account.id}:${metric.campaignExternalId}`,
        );
        return campaignId
          ? [{
              campaign_id: campaignId,
              date: metric.date,
              breakdown: metric.breakdown,
              value: metric.value,
              impressions: metric.impressions,
              reach: metric.reach,
              clicks: metric.clicks,
            }]
          : [];
      });
    });

    for (const batch of chunk(rows, 500)) {
      const { error } = await supabase.from("ad_audience_metrics").upsert(batch, {
        onConflict: "campaign_id,date,breakdown,value",
      });
      if (error) throw new Error(error.message);
    }
    revalidatePath("/analytics");
    const failedAccounts = results.filter((result) => result.status === "rejected").length;
    const failedBreakdowns = results.flatMap((result) =>
      result.status === "fulfilled"
        ? result.value.insights.failures.map((failure) => ({
            breakdown: AUDIENCE_BREAKDOWN_LABELS[failure.breakdown] ?? failure.breakdown,
            error: compactAudienceError(failure.error),
          }))
        : [],
    );
    const failuresByError = new Map<string, Set<string>>();
    for (const failure of failedBreakdowns) {
      const breakdowns = failuresByError.get(failure.error) ?? new Set<string>();
      breakdowns.add(failure.breakdown);
      failuresByError.set(failure.error, breakdowns);
    }
    const breakdownHint = [...failuresByError.entries()]
      .slice(0, 3)
      .map(([error, breakdowns]) => `${error} (${[...breakdowns].join(", ")})`)
      .join("; ");
    const failureHint = [
      failedAccounts ? `кабинетов пропущено: ${failedAccounts}` : null,
      breakdownHint
        ? `не загрузились срезы: ${breakdownHint}`
        : null,
    ].filter(Boolean).join("; ");
    return {
      ok: rows.length > 0,
      message: rows.length
        ? `Аудитория Meta обновлена: ${rows.length} срезов за 30 дней${failureHint ? `. Частично: ${failureHint}` : ""}.`
        : failureHint
          ? `Meta не вернула доступных срезов аудитории. ${failureHint}.`
          : "Meta не вернула доступных срезов аудитории за последние 30 дней.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Не удалось обновить аудиторию Meta.",
    };
  }
}

export async function assignSocialAccount(
  _prevState: AnalyticsActionState,
  formData: FormData,
): Promise<AnalyticsActionState> {
  void _prevState;
  try {
    const accountId = String(formData.get("account_id") ?? "");
    const projectId = String(formData.get("project_id") ?? "");
    if (!accountId) return { ok: false, message: "Instagram-аккаунт не выбран." };
    const supabase = await requireOwner();
    const { data, error } = await supabase
      .from("social_accounts")
      .update({ project_id: projectId || null })
      .eq("id", accountId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return { ok: false, message: "Привязка не изменена: проверьте доступ и повторите." };
    }
    revalidatePath("/analytics");
    return { ok: true, message: projectId ? "Привязка сохранена." : "Аккаунт отвязан от проекта." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Не удалось сохранить привязку.",
    };
  }
}

export async function ensureClientReport(
  _prevState: AnalyticsActionState,
  formData: FormData,
): Promise<AnalyticsActionState> {
  try {
    const projectId = String(formData.get("project_id") ?? "");
    if (!projectId) return { ok: false, message: "Сначала выберите проект." };
    const supabase = await requireOwner();
    const { data, error } = await supabase
      .from("client_reports")
      .upsert({ project_id: projectId, is_active: true }, { onConflict: "project_id" })
      .select("public_token")
      .single();
    if (error) throw new Error(error.message);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agency-os-lilac-eight.vercel.app";
    const url = `${baseUrl}/report/${data.public_token}`;
    revalidatePath("/analytics");
    return { ok: true, message: "Клиентская ссылка готова.", url };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Не удалось создать ссылку.",
    };
  }
}
