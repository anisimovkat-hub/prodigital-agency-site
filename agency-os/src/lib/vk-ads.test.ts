import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ensureVkToken } from "@/lib/vk-ads";

const fetchMock = vi.fn();
const json = (data: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => data }) as Response;

describe("ensureVkToken", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });

  it("reuses a live token without calling VK", async () => {
    const credential = { clientId: "1", clientSecret: "s", accessToken: "live", expiresAt: Date.now() + 3_600_000 };
    await expect(ensureVkToken(credential)).resolves.toEqual({ credential, changed: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes an expired token with the stored refresh token", async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: "new", refresh_token: "r2", expires_in: 86400 }));
    const { credential, changed } = await ensureVkToken({ clientId: "1", clientSecret: "s", accessToken: "old", refreshToken: "r1", expiresAt: 0 });
    expect(changed).toBe(true);
    expect(credential.accessToken).toBe("new");
    expect(String(fetchMock.mock.calls[0][1].body)).toContain("grant_type=refresh_token");
  });

  it("revokes old tokens and starts over when refresh fails", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: "invalid_grant" }, false))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({ access_token: "fresh", refresh_token: "r", expires_in: 86400 }));
    const { credential } = await ensureVkToken({ clientId: "1", clientSecret: "s", refreshToken: "dead" });
    expect(credential.accessToken).toBe("fresh");
    expect(fetchMock.mock.calls[1][0]).toContain("token/delete.json");
  });
});
