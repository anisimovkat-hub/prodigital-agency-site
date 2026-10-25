import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchTeamTripMetaExport, teamTripPeriod } from "@/lib/team-trip-meta-export";
import { GET, HEAD, OPTIONS } from "@/app/api/exports/team-trip-meta/route";

const ID = "1018564883119850";
const SECRET = "test-only-team-trip-export-key-32bytes";
const period = { since: "2026-10-12", until: "2026-10-18" };
const now = new Date("2026-10-25T06:00:00Z");
const account = { account_id: ID, name: "Team Trip", currency: "USD", timezone_name: "Europe/Moscow" };
const base = {
  account_id: ID, account_currency: "USD", date_start: period.since, date_stop: period.since,
  spend: "12.34", impressions: "100", clicks: "5", inline_link_clicks: "3",
};
const detail = {
  ...base, campaign_id: "1", campaign_name: "Messages", adset_id: "2", adset_name: "Марокко",
  ad_id: "3", ad_name: "Ad", objective: "OUTCOME_SALES",
  actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "2" }],
};
const fetchMock = vi.fn();
let adData: unknown[];
let controlData: unknown[];
let metadata: unknown;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv("META_ACCESS_TOKEN", "test-meta-token");
  vi.stubEnv("TEAM_TRIP_SHEETS_SECRET", SECRET);
  vi.stubGlobal("fetch", fetchMock);
  adData = [detail]; controlData = [base]; metadata = account;
  fetchMock.mockReset().mockImplementation(async (url: string) => {
    const query = new URL(url);
    const value = query.pathname.endsWith("/insights")
      ? { data: query.searchParams.get("level") === "ad" ? adData : controlData } : metadata;
    return { ok: true, json: async () => value };
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("Team Trip export periods", () => {
  it("accepts only an already completed Moscow Monday–Sunday week", () => {
    expect(teamTripPeriod(new URLSearchParams(period), now)).toEqual(period);
    expect(() => teamTripPeriod(new URLSearchParams({ since: "2026-10-19", until: "2026-10-25" }), now)).toThrow("INVALID_PERIOD");
    // 21:01 UTC Sunday is already Monday in Moscow.
    expect(teamTripPeriod(new URLSearchParams({ since: "2026-10-19", until: "2026-10-25" }), new Date("2026-10-25T21:01:00Z")))
      .toEqual({ since: "2026-10-19", until: "2026-10-25" });
  });
  it.each([
    "since=2026-02-30&until=2026-03-08", "since=2026-10-13&until=2026-10-19",
    "since=2026-10-12&until=2026-10-20", "since=2025-10-13&until=2025-10-19",
    "since=2026-10-12", "since=2026-10-12&until=2026-10-18&account_id=other",
    "since=2026-10-12&until=2026-10-18&since=2026-10-12",
  ])("rejects %s", (query) => expect(() => teamTripPeriod(new URLSearchParams(query), now)).toThrow("INVALID_PERIOD"));
});

describe("Team Trip live Meta isolation and completeness", () => {
  it("reads only the fixed account, uses header auth, and returns whitelisted daily rows", async () => {
    adData = [{ ...detail, access_token: "must-not-escape" }];
    const result = await fetchTeamTripMetaExport(period, now);
    expect(result).toMatchObject({ schemaVersion: 1, source: "meta_live", period, account, details: [detail], controlRows: [base] });
    expect(JSON.stringify(result)).not.toMatch(/test-meta-token|must-not-escape|paging/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [raw, options] of fetchMock.mock.calls) {
      const url = new URL(raw);
      expect(url.origin).toBe("https://graph.facebook.com");
      expect(url.pathname).toMatch(new RegExp(`^/v23.0/act_${ID}(/insights)?$`));
      expect(url.searchParams.has("access_token")).toBe(false);
      expect(options).toMatchObject({ headers: { Authorization: "Bearer test-meta-token" }, cache: "no-store", redirect: "error" });
      if (url.pathname.endsWith("/insights")) {
        expect(url.searchParams.get("time_increment")).toBe("1");
        expect(url.searchParams.get("action_report_time")).toBe("impression");
        expect(url.searchParams.get("use_unified_attribution_setting")).toBe("true");
      }
    }
  });
  it("uses only the cursor on the fixed host, including empty intermediate pages", async () => {
    const initial = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (raw, options) => {
      const url = new URL(raw);
      if (url.searchParams.get("level") === "ad" && !url.searchParams.has("after")) {
        return { ok: true, json: async () => ({ data: [], paging: { next: "https://evil.invalid/?access_token=secret", cursors: { after: "cursor-1" } } }) };
      }
      return initial(raw, options);
    });
    expect((await fetchTeamTripMetaExport(period, now)).details).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([raw]) => new URL(raw).searchParams.get("after") === "cursor-1")).toBe(true);
    expect(fetchMock.mock.calls.every(([raw]) => new URL(raw).hostname === "graph.facebook.com")).toBe(true);
  });
  it("rejects repeated pagination cursors rather than truncating a report", async () => {
    fetchMock.mockImplementation(async (raw) => ({ ok: true, json: async () => new URL(raw).pathname.endsWith("/insights")
      ? { data: [], paging: { next: "hidden", cursors: { after: "same" } } } : account }));
    await expect(fetchTeamTripMetaExport(period, now)).rejects.toThrow("INVALID_META_PAGING");
  });
  it.each([
    ["different account", { ...detail, account_id: "999" }, "INVALID_META_SCOPE"],
    ["different currency", { ...detail, account_currency: "EUR" }, "INVALID_META_SCOPE"],
    ["outside period", { ...detail, date_start: "2026-10-11", date_stop: "2026-10-11" }, "INVALID_META_SCOPE"],
    ["missing spend", { ...detail, spend: undefined }, "INVALID_META_RESPONSE"],
    ["negative spend", { ...detail, spend: "-1" }, "INVALID_META_RESPONSE"],
    ["fractional impressions", { ...detail, impressions: "1.5" }, "INVALID_META_RESPONSE"],
    ["missing stable ID", { ...detail, adset_id: undefined }, "INVALID_META_RESPONSE"],
    ["duplicate action", { ...detail, actions: [...detail.actions, ...detail.actions] }, "DUPLICATE_META_ACTION"],
  ])("rejects %s", async (_label, row, error) => {
    adData = [row];
    await expect(fetchTeamTripMetaExport(period, now)).rejects.toThrow(error as string);
  });
  it("preserves unavailable conversions, not an invented zero", async () => {
    adData = [{ ...detail, actions: undefined }];
    expect((await fetchTeamTripMetaExport(period, now)).details[0]).not.toHaveProperty("actions");
  });
  it("rejects duplicate ad-days and control days", async () => {
    adData = [detail, detail];
    await expect(fetchTeamTripMetaExport(period, now)).rejects.toThrow("DUPLICATE_META_ROW");
    adData = [detail]; controlData = [base, base];
    await expect(fetchTeamTripMetaExport(period, now)).rejects.toThrow("DUPLICATE_META_ROW");
  });
  it.each(["spend", "impressions", "inline_link_clicks"])("rejects account/detail %s mismatch", async (field) => {
    controlData = [{ ...base, [field]: "999" }];
    await expect(fetchTeamTripMetaExport(period, now)).rejects.toThrow("META_TOTAL_MISMATCH");
  });
  it("does not convert an empty response into zero spend", async () => {
    adData = [];
    await expect(fetchTeamTripMetaExport(period, now)).rejects.toThrow("EMPTY_META_EXPORT");
  });
  it("does not load anything if Meta is not configured", async () => {
    vi.stubEnv("META_ACCESS_TOKEN", "");
    await expect(fetchTeamTripMetaExport(period, now)).rejects.toThrow("META_NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("sanitizes raw network errors", async () => {
    fetchMock.mockRejectedValue(new Error("private upstream URL and token"));
    await expect(fetchTeamTripMetaExport(period, now)).rejects.toThrow(/^META_UNAVAILABLE$/);
  });
});

describe("Team Trip HTTP route", () => {
  function request(query = new URLSearchParams(period).toString(), key = SECRET) {
    return new Request(`https://prodigital-os.vercel.app/api/exports/team-trip-meta?${query}`, { headers: { Authorization: `Bearer ${key}` } });
  }
  it.each(["wrong", "", "é".repeat(SECRET.length)])("rejects invalid key without contacting Meta (%s)", async (key) => {
    const response = await GET(request(undefined, key));
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("fails closed before a separate secret is configured", async () => {
    vi.stubEnv("TEAM_TRIP_SHEETS_SECRET", "");
    expect((await GET(request())).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects query-account overrides before contacting Meta", async () => {
    expect((await GET(request(`${new URLSearchParams(period)}&account_id=999`))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("serves only a fresh validated response", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ source: "meta_live", generatedAt: now.toISOString(), period, account });
  });
  it("returns a safe error and no partial data on upstream failure", async () => {
    fetchMock.mockRejectedValue(new Error("secret token"));
    const response = await GET(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "META_UNAVAILABLE" });
  });
  it("HEAD and OPTIONS do not call Meta", () => {
    expect(HEAD().status).toBe(405); expect(OPTIONS().status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
