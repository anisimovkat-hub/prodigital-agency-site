"use server";

import { revalidatePath } from "next/cache";

import {
  fetchInstagramAccountMetrics,
  fetchInstagramAccounts,
  fetchInstagramMedia,
} from "@/lib/meta-instagram";
import { createClient } from "@/lib/supabase/server";

export type AnalyticsActionState =
  | { ok: boolean; message: string; url?: string }
  | undefined;

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
    const accounts = await fetchInstagramAccounts();
    if (accounts.length === 0) {
      return {
        ok: false,
        message:
          "Instagram-аккаунты не найдены. Текущему Meta-токену нужны права instagram_basic, instagram_manage_insights и pages_read_engagement.",
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
          last_synced_at: now,
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
    const results = await Promise.allSettled(
      rows.map(async (row) => {
        const [daily, media] = await Promise.all([
          fetchInstagramAccountMetrics(row.external_id, since, until),
          fetchInstagramMedia(row.external_id),
        ]);
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
              follower_growth: metric.followerCount,
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
        return { daily: daily.length, posts: media.length };
      }),
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
    revalidatePath("/analytics");
    return {
      ok: successful.length > 0,
      message: `Instagram обновлён: ${accounts.length} аккаунтов, ${dailyCount} дней, ${postCount} публикаций.`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Не удалось обновить Instagram.",
    };
  }
}

export async function assignSocialAccount(formData: FormData): Promise<void> {
  const accountId = String(formData.get("account_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!accountId) return;
  const supabase = await requireOwner();
  const { error } = await supabase
    .from("social_accounts")
    .update({ project_id: projectId || null })
    .eq("id", accountId);
  if (error) throw new Error(error.message);
  revalidatePath("/analytics");
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
