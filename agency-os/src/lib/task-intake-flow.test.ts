import { describe, expect, it } from "vitest";
import { chooseIntakeField, nextIntakeQuestion, type IntakeCatalog } from "./task-intake-flow";
import { parseIntakeTask } from "./task-intake-parser";

const now = new Date("2026-10-27T12:00:00Z");
const catalog: IntakeCatalog = {
  projects: [
    { id: "trip", name: "Team Trip", aliases: [], stage: "active", memberIds: ["ilona"] },
    { id: "mos", name: "Мос.ру", aliases: ["Моспром"], clientName: "БЛЭК", stage: "completed", memberIds: [] },
    { id: "fck", name: "ФЦК", aliases: ["Производительность РФ"], clientName: "БЛЭК", stage: "active", memberIds: [] },
  ],
  profiles: [{ id: "ilona", name: "Илона", aliases: ["Илоне"] }, { id: "sofa", name: "Софа", aliases: ["Софе"] }],
};
const parse = (text: string) => parseIntakeTask(text, catalog.projects, catalog.profiles, now);

describe("shared live/preview intake questions", () => {
  it("has no question for a complete ordinary task", () => {
    expect(nextIntakeQuestion(parse("Илона Team Trip завтра подготовить отчёт"), catalog, now)).toBeNull();
  });
  it("asks which project for a client name and never guesses", () => {
    const item = parse("Илона БЛЭК завтра отчёт");
    expect(item.projectId).toBeNull();
    expect(nextIntakeQuestion(item, catalog, now)).toMatchObject({ field: "project", choices: [{ id: "mos" }, { id: "fck" }, { id: "other" }] });
  });
  it("requires another choice for a completed project", () => {
    expect(nextIntakeQuestion(parse("Илоне Моспром завтра отчёт"), catalog, now)).toMatchObject({ field: "project", choices: [{ id: "other" }] });
  });
  it("offers project staff for an unknown employee", () => {
    expect(nextIntakeQuestion(parse("Мише Team Trip завтра отчёт"), catalog, now)).toMatchObject({ field: "assignee", choices: [{ id: "ilona" }, { id: "other" }] });
  });
  it("accepts an explicit no-deadline choice instead of guessing a date", () => {
    const item = parse("Илона Team Trip отчёт");
    expect(nextIntakeQuestion(item, catalog, now)).toMatchObject({ field: "deadline", choices: [{ id: "2026-10-27" }, { id: "2026-10-28" }, { id: "2026-10-30" }, { id: "none" }] });
    const chosen = chooseIntakeField(item, "deadline", "none");
    expect(chosen).toMatchObject({ dueDate: null, deadlineKnown: true });
    expect(nextIntakeQuestion(chosen, catalog, now)).toBeNull();
  });
  it("offers close spellings but requires the owner's choice", () => {
    const item = parse("Илоне Team Tri завтра отчёт");
    expect(item.projectId).toBeNull();
    expect(nextIntakeQuestion(item, catalog, now)?.choices[0].id).toBe("trip");
  });
});
