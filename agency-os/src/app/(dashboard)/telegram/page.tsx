import { notFound } from "next/navigation";
import { requireTelegramBotOwner } from "@/lib/telegram-bot-owner";
import { TelegramBotPanel } from "./telegram-bot-panel";

export const dynamic = "force-dynamic";

export default async function TelegramBotPage() {
  try { await requireTelegramBotOwner(); } catch { notFound(); }
  // Loading a page never calls Telegram or changes webhook registration.
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Рабочий бот</h1>
        <p className="mt-2 text-sm text-neutral-600">Проверка подключения @ai_Pro_Digital_bot.</p>
      </div>
      <TelegramBotPanel />
    </div>
  );
}
