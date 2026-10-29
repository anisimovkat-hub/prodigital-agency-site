import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { checkTelegramBot, restoreTelegramUpdates } from "./telegram-bot-admin";

const fetchMock = vi.fn();
const URL = "https://prodigital-os.vercel.app/api/telegram/webhook";
const TOKEN = "synthetic-test-token-only";
const SECRET = "synthetic-test-secret-only";
const me = { id: 999, is_bot: true, username: "ai_Pro_Digital_bot" };
const info = {
  url: URL, has_custom_certificate: false, pending_update_count: 0,
  max_connections: 25, allowed_updates: ["callback_query", "my_chat_member"],
};

function response(result: unknown, status = 200) {
  return Response.json({ ok: status === 200, result }, { status });
}
function healthy(overrides = {}) {
  fetchMock.mockResolvedValueOnce(response(me));
  fetchMock.mockResolvedValueOnce(response({ ...info, ...overrides }));
}
const methods = () => fetchMock.mock.calls.map(([url]) => String(url).split("/").pop());

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("owner bot maintenance transport", () => {
  it("reads only getMe and getWebhookInfo, returning an explicit safe DTO", async () => {
    healthy({ pending_update_count: 7, last_error_message: "private-value-not-returned", last_error_date: 1793275200 });
    const result = await checkTelegramBot();
    expect(result).toMatchObject({ botVerified: true, webhook: "expected", messagesEnabled: false,
      callbacksEnabled: true, membershipEnabled: true, pendingUpdates: 7, hasDeliveryError: true,
      needsRepair: true, canRepair: true });
    expect(result.lastDeliveryErrorAt).toMatch(/^2026-/);
    expect(methods()).toEqual(["getMe", "getWebhookInfo"]);
    const serialized = JSON.stringify(result);
    for (const forbidden of [TOKEN, SECRET, URL, "private-value-not-returned", '"id"']) expect(serialized).not.toContain(forbidden);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options).toMatchObject({ method: "POST", cache: "no-store", redirect: "error" });
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it.each(["preview", "development", ""])('blocks all calls outside production (%s)', async (environment) => {
    vi.stubEnv("VERCEL_ENV", environment);
    await expect(checkTelegramBot()).rejects.toMatchObject({ code: "production_only" });
    await expect(restoreTelegramUpdates(true)).rejects.toMatchObject({ code: "production_only" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires configured token and never returns fetch or Telegram error details", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    await expect(checkTelegramBot()).rejects.toMatchObject({ code: "configuration_missing" });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
    fetchMock.mockRejectedValueOnce(new Error(`https://api.telegram.org/bot${TOKEN}/getMe`));
    await expect(checkTelegramBot()).rejects.toThrow("telegram_unavailable");
    fetchMock.mockResolvedValueOnce(Response.json({ ok: false, description: `${SECRET} private-id` }));
    await expect(checkTelegramBot()).rejects.toThrow("telegram_unavailable");
    fetchMock.mockResolvedValueOnce(new Response("not-json"));
    await expect(checkTelegramBot()).rejects.toThrow("telegram_unavailable");
  });

  it("blocks the wrong bot before webhook diagnosis or mutation", async () => {
    fetchMock.mockResolvedValueOnce(response({ ...me, username: "other_bot" }));
    await expect(restoreTelegramUpdates(true)).rejects.toMatchObject({ code: "unexpected_bot" });
    expect(methods()).toEqual(["getMe"]);
  });

  it.each([undefined, [], ["message"], ["message", "callback_query", "my_chat_member"]])(
    "does not call setWebhook if message is already enabled, including default subscriptions (%j)", async (allowed_updates) => {
      healthy({ allowed_updates });
      const result = await restoreTelegramUpdates(true);
      expect(result.changed).toBe(false);
      expect(result.health.messagesEnabled).toBe(true);
      expect(result.health.canRepair).toBe(false);
      expect(methods()).toEqual(["getMe", "getWebhookInfo"]);
    },
  );

  it("requires an explicit confirmation before even reading Telegram", async () => {
    await expect(restoreTelegramUpdates(false)).rejects.toMatchObject({ code: "confirmation_required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves webhook URL, env secret, max connections and extra subscriptions without dropping pending updates", async () => {
    const allowed = ["callback_query", "edited_message"];
    healthy({ allowed_updates: allowed });
    fetchMock.mockResolvedValueOnce(response(true));
    healthy({ allowed_updates: [...allowed, "message", "my_chat_member"] });
    const result = await restoreTelegramUpdates(true);
    expect(result.changed).toBe(true);
    expect(result.health.messagesEnabled).toBe(true);
    expect(methods()).toEqual(["getMe", "getWebhookInfo", "setWebhook", "getMe", "getWebhookInfo"]);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      url: URL, secret_token: SECRET, max_connections: 25,
      allowed_updates: ["callback_query", "edited_message", "message", "my_chat_member"], drop_pending_updates: false,
    });
  });

  it.each([
    { url: "" }, { url: "https://unknown.invalid/api/telegram/webhook" },
    { url: "https://prodigital-os.vercel.app/api/telegram/webhook?secret=private" },
    { url: "https://private@prodigital-os.vercel.app/api/telegram/webhook" },
    { url: "http://prodigital-os.vercel.app/api/telegram/webhook" },
    { url: "https://prodigital-os.vercel.app/other" },
    { max_connections: undefined }, { max_connections: 0 }, { max_connections: 101 },
    { has_custom_certificate: true }, { has_custom_certificate: undefined },
  ])("refuses repair when existing settings cannot be safely preserved (%j)", async (overrides) => {
    healthy(overrides);
    await expect(restoreTelegramUpdates(true)).rejects.toMatchObject({ code: "unsafe_webhook" });
    expect(methods()).toEqual(["getMe", "getWebhookInfo"]);
  });

  it("accepts only the server-provided production alias, not preview or arbitrary hosts", async () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "agency-os-owner.vercel.app");
    healthy({ url: "https://agency-os-owner.vercel.app/api/telegram/webhook" });
    expect((await checkTelegramBot()).canRepair).toBe(true);
    healthy({ url: "https://agency-os-git-feature-owner.vercel.app/api/telegram/webhook" });
    expect((await checkTelegramBot()).canRepair).toBe(false);
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "untrusted.invalid");
    healthy({ url: "https://untrusted.invalid/api/telegram/webhook" });
    expect((await checkTelegramBot()).canRepair).toBe(false);
  });

  it.each(["", "bad secret", "x".repeat(257)])("blocks repair with missing or invalid existing webhook secret", async (secret) => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", secret);
    healthy();
    await expect(restoreTelegramUpdates(true)).rejects.toMatchObject({ code: "unsafe_webhook" });
    expect(methods()).not.toContain("setWebhook");
  });

  it("does not claim repair if Telegram returns false or post-check does not confirm it", async () => {
    healthy(); fetchMock.mockResolvedValueOnce(response(false));
    await expect(restoreTelegramUpdates(true)).rejects.toMatchObject({ code: "restore_unconfirmed" });
    expect(methods().filter((method) => method === "setWebhook")).toHaveLength(1);
    fetchMock.mockClear();
    healthy(); fetchMock.mockResolvedValueOnce(response(true)); healthy();
    await expect(restoreTelegramUpdates(true)).rejects.toMatchObject({ code: "restore_unconfirmed" });
    expect(methods().filter((method) => method === "setWebhook")).toHaveLength(1);
    fetchMock.mockClear();
    healthy(); fetchMock.mockResolvedValueOnce(response(true)); healthy({ allowed_updates: ["message"] });
    await expect(restoreTelegramUpdates(true)).rejects.toMatchObject({ code: "restore_unconfirmed" });
  });

  it.each([{ allowed_updates: "message" }, { allowed_updates: [123] }, { pending_update_count: -1 }])(
    "fails closed on malformed Telegram data (%j)", async (overrides) => {
      healthy(overrides);
      await expect(checkTelegramBot()).rejects.toMatchObject({ code: "telegram_unavailable" });
      expect(methods()).not.toContain("setWebhook");
    },
  );
});
