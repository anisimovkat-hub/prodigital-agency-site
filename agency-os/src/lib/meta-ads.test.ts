import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchMetaAudienceInsights } from "@/lib/meta-ads";

const fetchMock = vi.fn();

function response(data: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => data,
  } as Response;
}

describe("fetchMetaAudienceInsights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    process.env.META_ACCESS_TOKEN = "test-token";
  });

  it("передаёт демографию только через breakdowns, не через fields", async () => {
    fetchMock.mockImplementation(async (input: string) => {
      const url = new URL(input);
      const breakdown = url.searchParams.get("breakdowns")!;
      expect(url.searchParams.get("fields")).toBe("campaign_id,impressions,reach,clicks");
      return response({
        data: [{
          campaign_id: "campaign-1",
          date_start: "2026-08-10",
          impressions: "100",
          reach: "80",
          clicks: "5",
          [breakdown]: breakdown === "country" ? "IT" : "value",
        }],
      });
    });

    const result = await fetchMetaAudienceInsights("act_1", "2026-08-01", "2026-08-11");

    expect(result.metrics).toHaveLength(5);
    expect(result.failures).toEqual([]);
    expect(result.metrics.map((metric) => metric.breakdown)).toEqual([
      "age",
      "gender",
      "country",
      "region",
      "publisher_platform",
    ]);
  });

  it("возвращает точную ошибку отдельного среза и сохраняет остальные данные", async () => {
    fetchMock.mockImplementation(async (input: string) => {
      const url = new URL(input);
      const breakdown = url.searchParams.get("breakdowns")!;
      if (breakdown === "gender") {
        return response({ error: { message: "Недостаточно данных" } }, false);
      }
      return response({
        data: [{
          campaign_id: "campaign-1",
          date_start: "2026-08-10",
          impressions: "100",
          reach: "80",
          clicks: "5",
          [breakdown]: "value",
        }],
      });
    });

    const result = await fetchMetaAudienceInsights("act_1", "2026-08-01", "2026-08-11");

    expect(result.metrics).toHaveLength(4);
    expect(result.failures).toEqual([{
      breakdown: "gender",
      error: "Meta API: Недостаточно данных",
    }]);
  });
});
