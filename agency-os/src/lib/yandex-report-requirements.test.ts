import { describe, expect, it } from "vitest";
import { chooseYandexSyncGoals, yandexGoalAction } from "./yandex-goals";
import { requiredYandexReportGoals, YANDEX_REPORT_REQUIREMENTS, yandexReportRequirement } from "./yandex-report-requirements";

describe("bounded required reporting goals, independent of UI settings", () => {
  it.each(YANDEX_REPORT_REQUIREMENTS)("scopes $externalId to its exact account/project/model", (row) => {
    const account = { id: row.accountId, project_id: row.projectId, external_id: row.externalId };
    expect(yandexReportRequirement(account)).toBe(row);
    expect(yandexReportRequirement({ ...account, id: "other" })).toBeUndefined();
    expect(yandexReportRequirement({ ...account, project_id: "other" })).toBeUndefined();
    expect(yandexReportRequirement({ ...account, external_id: "other" })).toBeUndefined();
    expect(row.goalIds.length).toBeLessThanOrEqual(10);
  });
  it("includes required hidden nonprimary purchase without mutating owner settings", () => {
    const settings = [{ goal_key: "yandex:3071291494", hidden: true, is_primary: false }];
    const before = JSON.stringify(settings);
    const catalog = [{ id: "3071291494", name: "Purchase", domain: "", counterId: "71291494" }];
    expect(chooseYandexSyncGoals({ catalog, settings, requiredKeys: ["yandex:3071291494"], recentGoalIds: new Set() })).toEqual(catalog);
    expect(JSON.stringify(settings)).toBe(before);
    expect(chooseYandexSyncGoals({ catalog, settings, recentGoalIds: new Set() })).toEqual([]);
  });
  it("fails missing required catalog goals and over-limit requests instead of dropping them", () => {
    expect(() => requiredYandexReportGoals([], ["3071291494"])).toThrow("отсутствует в каталоге");
    expect(() => requiredYandexReportGoals([], Array(11).fill("42"))).toThrow("Слишком много");
    expect(() => chooseYandexSyncGoals({ catalog: [{ id: "42", name: "", domain: "", counterId: null }], settings: [], requiredKeys: ["yandex:42"], recentGoalIds: new Set(), limit: 0 })).toThrow("превышает лимит");
  });
  it("preserves the LC default used by existing consumers", () => {
    expect(yandexGoalAction("42")).toBe("yandex_goal:42:LC");
    expect(yandexGoalAction("42", "AUTO")).toBe("yandex_goal:42:AUTO");
  });
});
