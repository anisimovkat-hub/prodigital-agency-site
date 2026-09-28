import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/meta-ads", () => ({ fetchMetaAccounts: vi.fn() }));

import { fetchMetaAccounts } from "@/lib/meta-ads";
import { exportPeriods, fetchTalentPressMetaExport } from "@/lib/talent-press-meta-export";

const accounts = vi.mocked(fetchMetaAccounts);
const fetchMock = vi.fn();

describe("Talent Press Meta export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    process.env.META_ACCESS_TOKEN = "test-token";
    accounts.mockResolvedValue([
      { externalId: "act_1", name: "Talent Press 5", currency: "USD" },
      { externalId: "act_2", name: "Strategix", currency: "USD" },
    ]);
  });

  it("builds Thursday weeks and full calendar months through yesterday", () => {
    const periods = exportPeriods(new Date("2026-09-28T10:00:00Z"));
    expect(periods).toHaveLength(7);
    expect(periods[0]).toEqual({ start: "2026-09-24", end: "2026-09-27", kind: "week" });
    expect(periods[1]).toEqual({ start: "2026-09-17", end: "2026-09-23", kind: "week" });
    expect(periods[5]).toEqual({ start: "2026-09-01", end: "2026-09-27", kind: "month" });
    expect(periods[6]).toEqual({ start: "2026-08-01", end: "2026-08-31", kind: "month" });
  });

  it("uses only Talent Press 5, omits zero-spend rows, and counts only the selected custom conversion", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        {
          campaign_name: "Visa USA", country: "US", spend: "20.5", reach: "90",
          impressions: "100", clicks: "7", inline_link_clicks: "4",
          actions: [
            { action_type: "offsite_conversion.custom.855682077406013", value: "2" },
            { action_type: "lead", value: "9" },
          ],
        },
        { campaign_name: "Paused", country: "US", spend: "0", impressions: "100" },
      ] }),
    });

    const result = await fetchTalentPressMetaExport(new Date("2026-09-28T10:00:00Z"));
    expect(result.asOf).toBe("2026-09-27");
    expect(result.periods).toHaveLength(7);
    expect(result.periods[0].rows).toEqual([{
      period: "2026-09-24 - 2026-09-27", campaign: "Visa USA", country: "US",
      spend: 20.5, reach: 90, impressions: 100, clicks: 7, linkClicks: 4, leads: 2,
    }]);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes("/act_1/insights?"))).toBe(true);
  });
});
