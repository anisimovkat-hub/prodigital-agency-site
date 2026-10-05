import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchTelegramAdDays } from "@/lib/telegram-ads";

const fetchMock = vi.fn();
const json = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;

describe("fetchTelegramAdDays", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); });

  it("turns daily ad stats into dated rows and skips empty days", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ ok: true, result: { ads: [{ ad_id: 7, title: "СОДА — канал" }] } }))
      .mockResolvedValueOnce(json({ ok: true, result: [
        { from_time: Date.UTC(2026, 9, 1) / 1000, spent_budget: 1.5, views: 300, clicks: 4, joins: 2 },
        { from_time: Date.UTC(2026, 9, 2) / 1000, spent_budget: 0, views: 0, clicks: 0, joins: 0 },
      ] }));
    await expect(fetchTelegramAdDays("t", "2026-10-01", "2026-10-02")).resolves.toEqual([
      { adId: "7", title: "СОДА — канал", date: "2026-10-01", spendTon: 1.5, views: 300, clicks: 4, joins: 2 },
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ ad_id: 7, interval: 86400 });
  });
});
