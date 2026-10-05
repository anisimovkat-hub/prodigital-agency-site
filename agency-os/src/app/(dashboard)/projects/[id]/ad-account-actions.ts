"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";

import { lastDaysPeriod } from "@/lib/analytics-period";
import {
  fetchConnectedDays,
  saveSecret,
  storeCampaignDays,
  syncConnectedAccounts,
  type ConnectedPlatform,
  type ConnectedSecret,
} from "@/lib/connected-ads-sync";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchTelegramAds } from "@/lib/telegram-ads";
import { ensureVkToken, fetchVkAccountName } from "@/lib/vk-ads";
import { fetchYandexClient } from "@/lib/yandex-direct";

export type AdAccountState = { ok: boolean; message: string } | undefined;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// First import covers a quarter so a newly connected account has history to compare.
const INITIAL_DAYS = 90;
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

/** RLS decides: the project is visible only to its members and the owner. */
async function projectAccess(projectId: string) {
  if (!UUID.test(projectId)) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: project }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("id").eq("id", projectId).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  return project ? { userId: user.id, isOwner: profile?.role === "owner" } : null;
}

type Verified = { externalId: string; name: string; currency: string | null; secret: ConnectedSecret };

/** Calls the platform with the pasted key: a key that works is the proof of access. */
async function verify(platform: ConnectedPlatform, formData: FormData): Promise<Verified> {
  if (platform === "yandex_direct") {
    const token = text(formData, "token");
    const clientLogin = text(formData, "client_login").toLowerCase() || undefined;
    if (!token) throw new Error("Вставьте OAuth-токен Яндекса.");
    const client = await fetchYandexClient({ token, clientLogin });
    return { externalId: client.login.toLowerCase(), name: client.name ?? client.login, currency: client.currency, secret: { token, clientLogin: clientLogin ?? client.login } };
  }
  if (platform === "telegram_ads") {
    const token = text(formData, "token");
    const name = text(formData, "name");
    if (!token || !name) throw new Error("Укажите название кабинета и API-токен Telegram Ads.");
    const ads = await fetchTelegramAds(token);
    // The API has no account id. The first ad id stays the same when the key is reissued;
    // an empty account falls back to a hash, which never stores the key in plain text.
    const firstAd = ads.map((ad) => Number(ad.ad_id)).filter(Number.isFinite).sort((a, b) => a - b)[0];
    const externalId = firstAd !== undefined ? `tg-ad-${firstAd}` : `tg-${createHash("sha256").update(token).digest("hex").slice(0, 16)}`;
    return { externalId, name, currency: "RUB", secret: { token } };
  }
  const clientId = text(formData, "client_id");
  const clientSecret = text(formData, "client_secret");
  if (!clientId || !clientSecret) throw new Error("Укажите Client ID и Client secret VK Рекламы.");
  const { credential } = await ensureVkToken({ clientId, clientSecret });
  const name = (await fetchVkAccountName(credential.accessToken!)) ?? `VK ${clientId}`;
  return { externalId: `vk-${clientId}`, name, currency: "RUB", secret: credential };
}

export async function connectAdAccount(_state: AdAccountState, formData: FormData): Promise<AdAccountState> {
  const projectId = text(formData, "project_id");
  const platform = text(formData, "platform");
  const access = await projectAccess(projectId);
  if (!access) return { ok: false, message: "Нет доступа к проекту." };
  const service = createServiceClient();

  if (platform === "meta") {
    if (!access.isOwner) return { ok: false, message: "Кабинеты Meta привязывает владелец агентства." };
    const accountId = text(formData, "meta_account_id");
    if (!UUID.test(accountId)) return { ok: false, message: "Выберите кабинет Meta." };
    const { data, error } = await service.from("ad_accounts").update({ project_id: projectId, is_active: true })
      .eq("id", accountId).eq("platform", "meta").is("project_id", null).select("id").maybeSingle();
    if (error || !data) return { ok: false, message: "Кабинет уже привязан или недоступен." };
    await service.from("ad_campaigns").update({ project_id: projectId }).eq("ad_account_id", accountId).is("project_id", null);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, message: "Кабинет Meta привязан. Статистика подтянется при ближайшей загрузке Meta." };
  }
  if (platform !== "yandex_direct" && platform !== "telegram_ads" && platform !== "vk") return { ok: false, message: "Выберите площадку." };

  let verified: Verified;
  try {
    verified = await verify(platform, formData);
  } catch (error) {
    return { ok: false, message: `Ключ не подошёл: ${error instanceof Error ? error.message : "площадка не ответила"}` };
  }
  const { data: existing } = await service.from("ad_accounts").select("id,project_id").eq("platform", platform).eq("external_id", verified.externalId).maybeSingle();
  if (existing?.project_id && existing.project_id !== projectId) return { ok: false, message: "Этот кабинет уже подключён к другому проекту." };
  const { data: account, error } = await service.from("ad_accounts").upsert({
    platform, external_id: verified.externalId, name: verified.name, currency: verified.currency, project_id: projectId, is_active: true,
  }, { onConflict: "platform,external_id" }).select("id,project_id").single();
  if (error || !account) return { ok: false, message: `Не удалось сохранить кабинет: ${error?.message ?? ""}` };
  try {
    await saveSecret(service, account.id, verified.secret, access.userId);
    const days = await fetchConnectedDays(service, { id: account.id, platform }, lastDaysPeriod(new Date(), INITIAL_DAYS));
    await storeCampaignDays(service, { id: account.id, project_id: projectId }, days);
    await service.from("ad_account_credentials").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("ad_account_id", account.id);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/analytics");
    return { ok: true, message: `Кабинет «${verified.name}» подключён, загружено ${days.length} строк за ${INITIAL_DAYS} дней. Дальше данные обновляются каждое утро.` };
  } catch (syncError) {
    revalidatePath(`/projects/${projectId}`);
    return { ok: false, message: `Кабинет подключён, но первая загрузка не удалась: ${syncError instanceof Error ? syncError.message : "ошибка площадки"}` };
  }
}

export async function syncProjectAdAccounts(_state: AdAccountState, formData: FormData): Promise<AdAccountState> {
  const projectId = text(formData, "project_id");
  if (!(await projectAccess(projectId))) return { ok: false, message: "Нет доступа к проекту." };
  try {
    const result = await syncConnectedAccounts(createServiceClient(), lastDaysPeriod(new Date(), 30), projectId);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/analytics");
    return { ok: result.ok, message: result.message };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Не удалось обновить кабинеты." };
  }
}

/** Removes the stored key; the account and its history stay for reports. */
export async function disconnectAdAccount(_state: AdAccountState, formData: FormData): Promise<AdAccountState> {
  const projectId = text(formData, "project_id");
  const accountId = text(formData, "account_id");
  if (!UUID.test(accountId) || !(await projectAccess(projectId))) return { ok: false, message: "Нет доступа к проекту." };
  const service = createServiceClient();
  const { data: account } = await service.from("ad_accounts").select("id").eq("id", accountId).eq("project_id", projectId).maybeSingle();
  if (!account) return { ok: false, message: "Кабинет не найден в этом проекте." };
  const { error } = await service.rpc("delete_ad_account_secret", { p_account_id: accountId });
  if (error) return { ok: false, message: error.message };
  await service.from("ad_accounts").update({ is_active: false }).eq("id", accountId);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, message: "Кабинет отключён, ключ удалён. Прошлая статистика сохранена." };
}

/** Replaces an expired or revoked key of an already connected account, keeping its history. */
export async function replaceAdAccountKey(_state: AdAccountState, formData: FormData): Promise<AdAccountState> {
  const projectId = text(formData, "project_id");
  const accountId = text(formData, "account_id");
  const access = await projectAccess(projectId);
  if (!UUID.test(accountId) || !access) return { ok: false, message: "Нет доступа к проекту." };
  const service = createServiceClient();
  const { data: account } = await service.from("ad_accounts").select("id,platform,external_id").eq("id", accountId).eq("project_id", projectId).maybeSingle();
  if (!account || (account.platform !== "yandex_direct" && account.platform !== "telegram_ads" && account.platform !== "vk")) return { ok: false, message: "Кабинет не найден в этом проекте." };
  let verified: Verified;
  try {
    verified = await verify(account.platform, formData);
  } catch (error) {
    return { ok: false, message: `Ключ не подошёл: ${error instanceof Error ? error.message : "площадка не ответила"}` };
  }
  // A key of another cabinet would silently mix two accounts' statistics.
  if (account.platform !== "vk" && verified.externalId !== account.external_id) return { ok: false, message: "Этот ключ от другого кабинета. Подключите его как новый кабинет." };
  try {
    await saveSecret(service, account.id, verified.secret, access.userId);
    await service.from("ad_accounts").update({ is_active: true }).eq("id", account.id);
    const days = await fetchConnectedDays(service, { id: account.id, platform: account.platform }, lastDaysPeriod(new Date(), INITIAL_DAYS));
    await storeCampaignDays(service, { id: account.id, project_id: projectId }, days);
    await service.from("ad_account_credentials").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("ad_account_id", account.id);
  } catch (error) {
    return { ok: false, message: `Ключ сохранён, но загрузка не удалась: ${error instanceof Error ? error.message : "ошибка площадки"}` };
  } finally {
    revalidatePath(`/projects/${projectId}`);
  }
  return { ok: true, message: "Ключ заменён, статистика снова загружается." };
}
