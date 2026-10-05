import { describe, expect, it } from "vitest";
import { fetchCompleteQuery } from "@/lib/complete-query";

describe("complete analytics query", () => {
  it("reads past the API's first 1000 rows", async () => {
    const source = Array.from({ length: 2042 }, (_, id) => ({ id }));
    const result = await fetchCompleteQuery(async (from, to) => ({ data: source.slice(from, to + 1), error: null }), "Конверсии");
    expect(result.error).toBeNull();
    expect(result.data).toEqual(source);
  });
  it("does not present a partial report after a later page failed", async () => {
    const result = await fetchCompleteQuery(async (from) => from === 0
      ? { data: Array.from({ length: 1000 }, () => ({ id: 1 })), error: null }
      : { data: null, error: { message: "Unavailable" } }, "Конверсии");
    expect(result).toEqual({ data: null, error: { message: "Unavailable" } });
  });
  it("reports the limit instead of silently truncating", async () => {
    const result = await fetchCompleteQuery(async () => ({ data: Array.from({ length: 1000 }, () => 1), error: null }), "Конверсии", 1000);
    expect(result.data).toBeNull();
    expect(result.error?.message).toContain("Сократите период");
  });
});
