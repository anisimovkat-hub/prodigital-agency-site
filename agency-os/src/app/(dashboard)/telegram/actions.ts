"use server";

import { checkTelegramBot, restoreTelegramUpdates, TelegramAdminError, type TelegramBotHealth } from "@/lib/telegram-bot-admin";
import { requireTelegramActionOrigin, requireTelegramBotOwner } from "@/lib/telegram-bot-owner";

export type TelegramAdminResult = { ok: true; health: TelegramBotHealth; message: string } | { ok: false; message: string };

function failure(error: unknown): TelegramAdminResult {
  const code = error instanceof TelegramAdminError ? error.code : "telegram_unavailable";
  const messages = {
    production_only: "Проверка рабочего бота доступна только на рабочем сайте.",
    owner_only: "Этот раздел доступен только владельцу. Войдите в Agency OS заново.",
    same_origin_required: "Откройте этот раздел на рабочем сайте и повторите действие.",
    configuration_missing: "Серверная настройка бота отсутствует. Передайте этот результат в чат настройки.",
    telegram_unavailable: "Не удалось проверить Telegram. Настройки не подтверждены; повторите проверку позже.",
    unexpected_bot: "Сервер подключён к другому боту. Восстановление заблокировано.",
    unsafe_webhook: "Существующее подключение нельзя безопасно восстановить этой кнопкой. Передайте результат проверки в чат настройки.",
    confirmation_required: "Сначала подтвердите восстановление приёма сообщений.",
    restore_unconfirmed: "Не удалось подтвердить восстановление. Повторно проверьте подключение; успешную доставку это не подтверждает.",
  } as const;
  return { ok: false, message: messages[code] };
}

export async function inspectTelegramBot(): Promise<TelegramAdminResult> {
  try {
    await requireTelegramBotOwner();
    await requireTelegramActionOrigin();
    return { ok: true, health: await checkTelegramBot(), message: "Настройки проверены. Сообщения ботом не отправлялись." };
  } catch (error) { return failure(error); }
}

export async function repairTelegramBot(formData: FormData): Promise<TelegramAdminResult> {
  try {
    await requireTelegramBotOwner();
    await requireTelegramActionOrigin();
    const result = await restoreTelegramUpdates(formData.get("confirm_restore") === "yes");
    return {
      ok: true, health: result.health,
      message: result.changed
        ? "Приём сообщений восстановлен и настройка подтверждена. Отправьте боту новое /start: доставка ответа ещё не проверена."
        : "Приём новых сообщений уже включён. Настройки не менялись; причина отсутствия ответа пока не установлена.",
    };
  } catch (error) { return failure(error); }
}
