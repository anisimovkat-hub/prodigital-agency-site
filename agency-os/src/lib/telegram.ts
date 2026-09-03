type InlineButton = { text: string; callback_data: string };

type TelegramResponse<T> = { ok: boolean; result?: T; description?: string };

export type TelegramMessage = { message_id: number };

function token(): string {
  const value = process.env.TELEGRAM_BOT_TOKEN;
  if (!value) throw new Error("Telegram bot token is not configured.");
  return value;
}

async function callTelegram<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as TelegramResponse<T>;
  if (!response.ok || !payload.ok || !payload.result) {
    throw new Error(`Telegram ${method} failed: ${payload.description ?? response.status}`);
  }
  return payload.result;
}

export function sendTelegramMessage(
  chatId: string,
  text: string,
  buttons?: InlineButton[][],
): Promise<TelegramMessage> {
  return callTelegram<TelegramMessage>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

export function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<true> {
  return callTelegram<true>("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}
