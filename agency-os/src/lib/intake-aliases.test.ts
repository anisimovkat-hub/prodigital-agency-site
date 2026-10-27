import { describe, expect, it } from "vitest";
import { intakeAliasesSchema } from "./intake-aliases";

const base = { kind: "project", id: "00000000-0000-4000-8000-000000000000" };
describe("editable intake aliases", () => {
  it("trims and deduplicates names", () => expect(intakeAliasesSchema.parse({ ...base, text: " МосПром\nМос.ру;МосПром " }).text).toEqual(["МосПром", "Мос.ру"]));
  it("allows clearing aliases", () => expect(intakeAliasesSchema.parse({ ...base, text: "" }).text).toEqual([]));
  it("rejects an arbitrary table name", () => expect(intakeAliasesSchema.safeParse({ ...base, kind: "tasks", text: "test" }).success).toBe(false));
  it("rejects too many aliases", () => expect(intakeAliasesSchema.safeParse({ ...base, text: Array.from({ length: 41 }, (_, i) => `name${i}`).join("\n") }).success).toBe(false));
});
