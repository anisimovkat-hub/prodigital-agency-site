import { describe, expect, it } from "vitest";

import { describeAdSourceStatus } from "@/lib/ad-data-freshness";

describe("describeAdSourceStatus", () => {
  const now = new Date("2026-10-06T08:00:00Z");
  const synced = { platform: "meta", last_sync_at: "2026-10-06T03:01:00Z", last_sync_error: null };

  it("calls paused Meta ads paused, not a failed load", () => {
    expect(describeAdSourceStatus({ accounts: [synced], campaignStatuses: ["PAUSED", "ARCHIVED"], latestDate: "2026-09-28", hasDataInPeriod: false, now }))
      .toEqual({ state: "paused", message: "Реклама выключена: последние показы 28.09.2026." });
  });
  it("reports a real load error", () => {
    expect(describeAdSourceStatus({ accounts: [{ ...synced, last_sync_error: "(#200) нет доступа" }], campaignStatuses: ["ACTIVE"], latestDate: null, hasDataInPeriod: false, now }).state).toBe("error");
  });
  it("treats a successful load with no rows as no results", () => {
    expect(describeAdSourceStatus({ accounts: [synced], campaignStatuses: ["ACTIVE"], latestDate: "2026-09-01", hasDataInPeriod: false, now }).state).toBe("no_results");
  });
  it("flags a daily load that stopped running", () => {
    expect(describeAdSourceStatus({ accounts: [{ ...synced, last_sync_at: "2026-10-01T03:00:00Z" }], campaignStatuses: ["ACTIVE"], latestDate: "2026-10-01", hasDataInPeriod: true, now }).state).toBe("error");
  });
  it("is quiet when data is fresh", () => {
    expect(describeAdSourceStatus({ accounts: [synced], campaignStatuses: ["ACTIVE"], latestDate: "2026-10-05", hasDataInPeriod: true, now })).toEqual({ state: "ok", message: null });
  });
});
