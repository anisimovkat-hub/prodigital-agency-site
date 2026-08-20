"use server";

import {
  fetchYandexAgencyClients,
  type YandexAgencyClient,
} from "@/lib/yandex-direct";
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
