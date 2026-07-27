"use server";

import { revalidatePath } from "next/cache";

import { fetchMetaAccounts, fetchMetaInsights } from "@/lib/meta-ads";
import { createClient } from "@/lib/supabase/server";

export type SyncMetaState = { ok: boolean; message: string } | undefined;

const GENERIC_TOKENS = new Set([
  "ads",
  "account",
  "new",
  "the",
  "com",
  "lab",
  "asia",
]);

// Осторожное авто-сопоставление кабинета с проектом по совпадению слова в названии.
function matchProjectId(
  accountName: string | null,
  projects: { id: string; name: string }[],
): string | null {
  if (!accountName) return null;
  const acc = accountName.toLocaleLowerCase("ru-RU");
  for (const project of projects) {
    const tokens = project.name
      .toLocaleLowerCase("ru-RU")
      .split(/[^a-zа-я0-9]+/i)
      .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token));
    if (tokens.some((token) => acc.includes(token))) return project.id;
  }
  return null;
}

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export async function syncMetaAds(): Promise<SyncMetaState> {
  const supabase = await createClient();

  try {
    const accounts = await fetchMetaAccounts();
    if (accounts.length === 0) {
      return {
        ok: false,
        message:
          "Кабинеты не найдены. Проверьте, что токен выдан и кабинеты назначены системному пользователю.",
      };
    }

    const { data: projects } = await supabase
      .from("projects")
      .select("id,name");
    const projectList = projects ?? [];

    // 1) Обновляем/создаём кабинеты (project_id не трогаем — ручную привязку сохраняем).
    const { data: upserted, error: accErr } = await supabase
      .from("ad_accounts")
      .upsert(
        accounts.map((a) => ({
          platform: "meta",
          external_id: a.externalId,
          name: a.name,
          currency: a.currency,
        })),
        { onConflict: "platform,external_id" },
      )
      .select("id,external_id,name,project_id");
    if (accErr) throw new Error(accErr.message);

    // 2) Авто-привязка проекта для кабинетов без привязки.
    for (const row of upserted ?? []) {
      if (row.project_id) continue;
      const matched = matchProjectId(row.name, projectList);
      if (matched) {
        await supabase
          .from("ad_accounts")
          .update({ project_id: matched })
          .eq("id", row.id);
      }
    }

    // 3) Суточные метрики за последние 30 дней.
    const since = isoDaysAgo(30);
    const until = isoDaysAgo(0);
    let daysWritten = 0;
    for (const row of upserted ?? []) {
      const metrics = await fetchMetaInsights(row.external_id, since, until);
      if (metrics.length === 0) continue;
      const { error: mErr } = await supabase.from("ad_metrics").upsert(
        metrics.map((m) => ({
          ad_account_id: row.id,
          date: m.date,
          spend: m.spend,
          impressions: m.impressions,
          clicks: m.clicks,
          leads: m.leads,
        })),
        { onConflict: "ad_account_id,date" },
      );
      if (mErr) throw new Error(mErr.message);
      daysWritten += metrics.length;
    }

    revalidatePath("/ads");
    revalidatePath("/");
    return {
      ok: true,
      message: `Готово: кабинетов ${(upserted ?? []).length}, записей за дни ${daysWritten}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Ошибка синхронизации Meta.",
    };
  }
}
