import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/yandex-direct", () => ({ fetchYandexGoalReport: vi.fn(), fetchYandexCampaignInfo: vi.fn(), fetchYandexGoals: vi.fn(), readYandexGoalCounters: vi.fn() }));
import { fetchYandexGoalReport } from "./yandex-direct";
import { fetchRequiredYandexReportDays } from "./connected-ads-sync";
import { YANDEX_REPORT_REQUIREMENTS } from "./yandex-report-requirements";

const requirement = YANDEX_REPORT_REQUIREMENTS[0];
const catalog = requirement.goalIds.map((id) => ({ id, name: id, domain: "", counterId: null }));
const day = { campaignId: "101", campaignName: "Tools", date: "2026-10-27", cost: 0, clicks: 5, impressions: 100, conversions: null, goals: { "3071291494": 0 }, goalValues: { "3071291494": 0 } };
function service(overrides = {}) {
  const account = { id: requirement.accountId, project_id: requirement.projectId, external_id: requirement.externalId, platform: "yandex_direct", yandex_goals: catalog, ...overrides };
  const query = { select: vi.fn(), eq: vi.fn(), single: vi.fn(async () => ({ data: account, error: null })) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  const client = { from: vi.fn(() => query), rpc: vi.fn(async () => ({ data: JSON.stringify({ token: "test-only", clientLogin: requirement.externalId }), error: null })) };
  return { client: client as unknown as SupabaseClient<Database>, rpc: client.rpc, from: client.from };
}
describe("fixed required-report recovery fetch", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(fetchYandexGoalReport).mockResolvedValue([day]); });
  it("requests only fixed dates and bounded LC/LSCCD goal sets with existing server-owned auth", async () => {
    const { client, rpc, from } = service();
    const result = await fetchRequiredYandexReportDays(client, requirement.accountId);
    expect(fetchYandexGoalReport).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchYandexGoalReport).mock.calls.map((call) => [call[1], call[2], call[3].map((goal) => goal.id), call[4]?.attribution])).toEqual([
      ["2026-10-16", "2026-10-29", requirement.goalIds, "LC"], ["2026-10-16", "2026-10-29", requirement.goalIds, "LSCCD"],
    ]);
    expect(rpc).toHaveBeenCalledWith("read_ad_account_secret", { p_account_id: requirement.accountId });
    expect(from).toHaveBeenCalledTimes(1);
    expect(result.days[0].goalResults?.map((goal) => goal.action)).toEqual(["yandex_goal:3071291494:LC", "yandex_goal:3071291494:LSCCD"]);
  });
  it("rejects identity drift and missing required catalog goals before using credentials", async () => {
    for (const overrides of [{ project_id: "foreign" }, { external_id: "foreign" }, { yandex_goals: [] }]) {
      const { client, rpc } = service(overrides);
      await expect(fetchRequiredYandexReportDays(client, requirement.accountId)).rejects.toThrow();
      expect(rpc).not.toHaveBeenCalled();
    }
    expect(fetchYandexGoalReport).not.toHaveBeenCalled();
  });
  it("rejects empty required source data, dates outside the window and model errors", async () => {
    vi.mocked(fetchYandexGoalReport).mockResolvedValue([]);
    await expect(fetchRequiredYandexReportDays(service().client, requirement.accountId)).rejects.toThrow("REPORT_PERIOD_MISMATCH");
    vi.mocked(fetchYandexGoalReport).mockResolvedValue([{ ...day, date: "2026-10-30" }]);
    await expect(fetchRequiredYandexReportDays(service().client, requirement.accountId)).rejects.toThrow("REPORT_PERIOD_MISMATCH");
    vi.mocked(fetchYandexGoalReport).mockRejectedValue(new Error("Source rejected model"));
    await expect(fetchRequiredYandexReportDays(service().client, requirement.accountId)).rejects.toThrow("Source rejected model");
  });
});
