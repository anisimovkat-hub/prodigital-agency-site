import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), headers: vi.fn(), check: vi.fn(), restore: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/telegram-bot-admin", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/telegram-bot-admin")>(), checkTelegramBot: mocks.check, restoreTelegramUpdates: mocks.restore,
}));
import { inspectTelegramBot, repairTelegramBot } from "./actions";
import { requireTelegramBotOwner } from "@/lib/telegram-bot-owner";

function owner(role = "owner", user: { id: string } | null = { id: "test-owner" }, error: object | null = null) {
  const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { role }, error }) };
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain);
  mocks.client.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) }, from: vi.fn(() => chain) });
}
function form(confirmed = true) {
  const data = new FormData(); if (confirmed) data.set("confirm_restore", "yes"); return data;
}

beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("VERCEL_ENV", "production");
  owner();
  mocks.headers.mockResolvedValue(new Headers({ origin: "https://prodigital-os.vercel.app", host: "prodigital-os.vercel.app" }));
  mocks.check.mockResolvedValue({ botVerified: true, messagesEnabled: false });
  mocks.restore.mockResolvedValue({ health: { botVerified: true, messagesEnabled: true }, changed: true });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("Telegram owner-only Server Actions", () => {
  it.each(["preview", "development", ""])('blocks action and page guard before auth/Telegram outside production (%s)', async (environment) => {
    vi.stubEnv("VERCEL_ENV", environment);
    expect((await inspectTelegramBot()).ok).toBe(false);
    expect((await repairTelegramBot(form())).ok).toBe(false);
    await expect(requireTelegramBotOwner()).rejects.toMatchObject({ code: "production_only" });
    expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.check).not.toHaveBeenCalled(); expect(mocks.restore).not.toHaveBeenCalled();
  });

  it.each(["specialist", "pm", "viewer"])('refuses %s in each action, not only in the page', async (role) => {
    owner(role);
    expect((await inspectTelegramBot()).ok).toBe(false);
    expect((await repairTelegramBot(form())).ok).toBe(false);
    expect(mocks.check).not.toHaveBeenCalled(); expect(mocks.restore).not.toHaveBeenCalled();
  });

  it("refuses absent sessions and profile lookup errors without exposing the error", async () => {
    owner("owner", null);
    expect((await inspectTelegramBot()).ok).toBe(false);
    owner("owner", { id: "test-owner" }, { message: "private-database-value" });
    const result = await repairTelegramBot(form());
    expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain("private-database-value");
    expect(mocks.check).not.toHaveBeenCalled(); expect(mocks.restore).not.toHaveBeenCalled();
  });

  it.each([
    { host: "prodigital-os.vercel.app" },
    { origin: "https://untrusted.invalid", host: "prodigital-os.vercel.app" },
    { origin: "http://prodigital-os.vercel.app", host: "prodigital-os.vercel.app" },
    { origin: "null", host: "prodigital-os.vercel.app" },
  ])("requires a matching HTTPS Origin for both actions (%j)", async (headers) => {
    const requestHeaders = new Headers();
    for (const [name, value] of Object.entries(headers)) if (typeof value === "string") requestHeaders.set(name, value);
    mocks.headers.mockResolvedValue(requestHeaders);
    expect((await inspectTelegramBot()).ok).toBe(false);
    expect((await repairTelegramBot(form())).ok).toBe(false);
    expect(mocks.check).not.toHaveBeenCalled(); expect(mocks.restore).not.toHaveBeenCalled();
  });

  it("accepts Vercel's forwarded host only with a matching Origin", async () => {
    mocks.headers.mockResolvedValue(new Headers({ origin: "https://prodigital-os.vercel.app", host: "internal.example", "x-forwarded-host": "prodigital-os.vercel.app" }));
    expect((await inspectTelegramBot()).ok).toBe(true);
    expect(mocks.check).toHaveBeenCalledOnce(); expect(mocks.restore).not.toHaveBeenCalled();
  });

  it("passes only the explicit confirmation to restore, never browser URLs, tokens or arbitrary methods", async () => {
    const data = form(); data.set("url", "https://untrusted.invalid"); data.set("token", "not-a-real-key"); data.set("method", "sendMessage");
    expect((await repairTelegramBot(data)).ok).toBe(true);
    expect(mocks.restore).toHaveBeenCalledWith(true);
    await repairTelegramBot(form(false));
    expect(mocks.restore).toHaveBeenLastCalledWith(false);
  });

  it("returns only fixed messages if a downstream error contains private details", async () => {
    mocks.check.mockRejectedValueOnce(new Error("secret-url-or-private-id"));
    const result = await inspectTelegramBot();
    expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain("secret-url-or-private-id");
  });

  it("does not present already-enabled message subscriptions as a successful repair", async () => {
    mocks.restore.mockResolvedValueOnce({ health: { messagesEnabled: true }, changed: false });
    const result = await repairTelegramBot(form());
    expect(result.ok).toBe(true); expect(result.message).toContain("Настройки не менялись");
  });
});
