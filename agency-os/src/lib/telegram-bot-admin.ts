import "server-only";

const EXPECTED_BOT = "ai_pro_digital_bot";
const REQUIRED_UPDATES = ["message", "callback_query", "my_chat_member"] as const;
const PRODUCTION_HOST = "prodigital-os.vercel.app";

export type TelegramAdminErrorCode =
  | "production_only" | "owner_only" | "same_origin_required"
  | "configuration_missing" | "telegram_unavailable" | "unexpected_bot"
  | "unsafe_webhook" | "confirmation_required" | "restore_unconfirmed";

export class TelegramAdminError extends Error {
  constructor(readonly code: TelegramAdminErrorCode) { super(code); }
}

export type TelegramBotHealth = {
  checkedAt: string;
  botVerified: true;
  webhook: "expected" | "missing" | "different";
  messagesEnabled: boolean;
  callbacksEnabled: boolean;
  membershipEnabled: boolean;
  pendingUpdates: number;
  hasDeliveryError: boolean;
  lastDeliveryErrorAt: string | null;
  needsRepair: boolean;
  canRepair: boolean;
};

type Snapshot = {
  health: TelegramBotHealth;
  url: string;
  maxConnections: number | null;
  customCertificate: boolean;
  allowedUpdates: string[] | undefined;
};

function productionOnly() {
  if (process.env.VERCEL_ENV !== "production") throw new TelegramAdminError("production_only");
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// Kept separate from the message transport: these are the only three methods
// this module can call. No chat IDs or messages enter this maintenance path.
async function call(method: "getMe" | "getWebhookInfo" | "setWebhook", body: Record<string, unknown> = {}): Promise<unknown> {
  productionOnly();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramAdminError("configuration_missing");
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body), cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const payload: unknown = await response.json();
    if (!response.ok || !record(payload) || payload.ok !== true || payload.result === undefined) {
      throw new Error("telegram_response_invalid");
    }
    return payload.result;
  } catch {
    // Never serialize Telegram descriptions or fetch errors: either may contain
    // a request URL, credentials, identifiers or other private response data.
    throw new TelegramAdminError("telegram_unavailable");
  }
}

function expectedWebhook(value: string): boolean {
  try {
    const url = new URL(value);
    const hosts = new Set([PRODUCTION_HOST]);
    const alias = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (alias && /^[a-z0-9-]+\.vercel\.app$/i.test(alias)) hosts.add(alias.toLowerCase());
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && !url.search && !url.hash && url.pathname === "/api/telegram/webhook"
      && hosts.has(url.hostname.toLowerCase());
  } catch { return false; }
}

function webhookSecret(): string | null {
  const value = process.env.TELEGRAM_WEBHOOK_SECRET;
  return value && /^[A-Za-z0-9_-]{1,256}$/.test(value) ? value : null;
}

async function snapshot(): Promise<Snapshot> {
  productionOnly();
  const me = await call("getMe");
  if (!record(me) || me.is_bot !== true || typeof me.username !== "string"
      || me.username.toLowerCase() !== EXPECTED_BOT) throw new TelegramAdminError("unexpected_bot");
  const info = await call("getWebhookInfo");
  if (!record(info) || typeof info.url !== "string"
      || !Number.isSafeInteger(info.pending_update_count) || (info.pending_update_count as number) < 0) {
    throw new TelegramAdminError("telegram_unavailable");
  }
  const allowed = info.allowed_updates;
  if (allowed !== undefined && (!Array.isArray(allowed) || allowed.length > 100
      || !allowed.every((entry) => typeof entry === "string" && /^[a-z_]{1,80}$/.test(entry)))) {
    throw new TelegramAdminError("telegram_unavailable");
  }
  const allowedUpdates = allowed as string[] | undefined;
  // An absent/empty list means Telegram's default subscriptions. All three
  // required types are in that default, so an empty list is not a diagnosis.
  const enabled = (kind: string) => !allowedUpdates?.length || allowedUpdates.includes(kind);
  // This repair is only for missing message subscriptions. Other differences
  // are reported without mutation when message is already enabled.
  const needsRepair = !enabled("message");
  const max = info.max_connections;
  const maxConnections = Number.isInteger(max) && (max as number) >= 1 && (max as number) <= 100 ? max as number : null;
  const customCertificate = info.has_custom_certificate !== false;
  const webhook = !info.url ? "missing" : expectedWebhook(info.url) ? "expected" : "different";
  const errorDate = typeof info.last_error_date === "number" ? new Date(info.last_error_date * 1000) : null;
  const lastDeliveryErrorAt = errorDate && Number.isFinite(errorDate.getTime()) ? errorDate.toISOString() : null;
  return {
    url: info.url, maxConnections, customCertificate, allowedUpdates,
    health: {
      checkedAt: new Date().toISOString(), botVerified: true, webhook,
      messagesEnabled: enabled("message"), callbacksEnabled: enabled("callback_query"),
      membershipEnabled: enabled("my_chat_member"), pendingUpdates: info.pending_update_count as number,
      hasDeliveryError: !!info.last_error_message || lastDeliveryErrorAt !== null, lastDeliveryErrorAt,
      needsRepair,
      canRepair: needsRepair && webhook === "expected" && maxConnections !== null && !customCertificate && webhookSecret() !== null,
    },
  };
}

export async function checkTelegramBot(): Promise<TelegramBotHealth> {
  return (await snapshot()).health;
}

export async function restoreTelegramUpdates(confirmed: boolean): Promise<{ health: TelegramBotHealth; changed: boolean }> {
  productionOnly();
  if (confirmed !== true) throw new TelegramAdminError("confirmation_required");
  // Re-read everything after the click; never trust a URL, token, bot identity
  // or previous diagnostic result supplied by the browser.
  const before = await snapshot();
  if (!before.health.needsRepair) return { health: before.health, changed: false };
  const secret = webhookSecret();
  if (!before.health.canRepair || !secret) throw new TelegramAdminError("unsafe_webhook");
  const allowed = [...new Set([...(before.allowedUpdates ?? []), ...REQUIRED_UPDATES])];
  const result = await call("setWebhook", {
    url: before.url, secret_token: secret, max_connections: before.maxConnections,
    allowed_updates: allowed, drop_pending_updates: false,
  });
  if (result !== true) throw new TelegramAdminError("restore_unconfirmed");
  // Confirm registration, not delivery. Do not send a test message or poll.
  const after = await snapshot();
  if (after.health.needsRepair || !after.health.callbacksEnabled || !after.health.membershipEnabled
      || after.url !== before.url || after.maxConnections !== before.maxConnections) {
    throw new TelegramAdminError("restore_unconfirmed");
  }
  return { health: after.health, changed: true };
}
