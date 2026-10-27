import { afterEach, describe, expect, it, vi } from "vitest";
import { isVercelPreview } from "./preview-policy";
import { answerCallbackQuery, sendTelegramMessage } from "./telegram";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("preview Telegram isolation", () => {
  it("blocks outgoing messages and callback replies before any network request", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(sendTelegramMessage("test", "test")).rejects.toThrow("disabled in Preview");
    await expect(answerCallbackQuery("test")).rejects.toThrow("disabled in Preview");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["production", "development", ""])("does not classify %s as preview", (env) => {
    vi.stubEnv("VERCEL_ENV", env); expect(isVercelPreview()).toBe(false);
  });
});
