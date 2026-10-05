"use server";

import { revalidatePath } from "next/cache";

import {
  fetchYandexAgencyClients,
  fetchYandexClient,
  type YandexAgencyClient,
} from "@/lib/yandex-direct";
import { syncYandexDirect } from "@/lib/yandex-sync";
import { createClient } from "@/lib/supabase/server";

export type YandexClientsState =
  | { ok: true; message: string; clients: YandexAgencyClient[] }
  | { ok: false; message: string; clients: [] }
  | undefined;

export async function discoverYandexAgencyClients(
  _previousState: YandexClientsState,
  _formData: FormData,
): Promise<YandexClientsState> {
  void _previousState;
  void _formData;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Нужна авторизация владельца.", clients: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "owner") {
    return { ok: false, message: "Список доступен только владельцу.", clients: [] };
  }

  try {
    const clients = await fetchYandexAgencyClients();
    return {
      ok: true,
      message: `Найдено кабинетов: ${clients.length}. Статистика и история пока не загружаются.`,
      clients,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Не удалось получить список кабинетов Яндекс.Директа.",
      clients: [],
    };
  }
}

export type YandexProjectState = { ok: boolean; message: string } | undefined;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function ownerClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "owner" ? supabase : null;
}

/** Checks read access to a Yandex Direct login, then links it to one active project. */
export async function linkYandexAccount(_state: YandexProjectState, formData: FormData): Promise<YandexProjectState> {
  const login = String(formData.get("login") ?? "").trim().toLowerCase();
  const projectId = String(formData.get("project_id") ?? "");
  if (!/^[a-z0-9][a-z0-9.\-_]{1,60}$/.test(login) || !UUID.test(projectId)) return { ok: false, message: "Укажите логин кабинета в Яндекс.Директе." };
  const supabase = await ownerClient();
  if (!supabase) return { ok: false, message: "Подключать кабинеты может только владелец." };
  const { data: existing } = await supabase.from("ad_accounts").select("project_id").eq("platform", "yandex_direct").eq("external_id", login).maybeSingle();
  if (existing?.project_id && existing.project_id !== projectId) return { ok: false, message: "Этот кабинет уже привязан к другому проекту." };
  let client;
  try {
    client = await fetchYandexClient(login);
  } catch (error) {
    return { ok: false, message: `Нет доступа к кабинету ${login}. ${error instanceof Error ? error.message : ""} Попросите клиента добавить ваш логин представителем с правом просмотра.` };
  }
  const { error } = await supabase.from("ad_accounts").upsert({
    platform: "yandex_direct", external_id: client.login.toLowerCase(), name: client.name ?? client.login,
    currency: client.currency, project_id: projectId, is_active: true,
  }, { onConflict: "platform,external_id" });
  if (error) return { ok: false, message: `Не удалось сохранить кабинет: ${error.message}` };
  revalidatePath("/analytics");
  return { ok: true, message: `Кабинет ${client.name ?? client.login} (${client.currency ?? "валюта неизвестна"}) подключён. Загрузите статистику.` };
}

/** Manual read-only import for the selected project and period. */
export async function syncYandexProject(_state: YandexProjectState, formData: FormData): Promise<YandexProjectState> {
  const projectId = String(formData.get("project_id") ?? "");
  const from = String(formData.get("from") ?? ""), to = String(formData.get("to") ?? "");
  if (!UUID.test(projectId) || !DATE.test(from) || !DATE.test(to) || from > to) return { ok: false, message: "Некорректный проект или период." };
  const supabase = await ownerClient();
  if (!supabase) return { ok: false, message: "Загружать статистику может только владелец." };
  try {
    const result = await syncYandexDirect(supabase, { from, to }, projectId);
    revalidatePath("/analytics");
    return { ok: result.ok, message: result.message };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Не удалось загрузить Яндекс.Директ." };
  }
}
