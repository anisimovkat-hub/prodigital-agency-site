import { describe, expect, it } from "vitest";
import { intakeDistance, matchIntakeEntities, normalizeIntakeText, parseIntakeDeadline, parseIntakeTask, parseIntakeEdit, splitIntakeTasks, uniqueExactIntakeMatch, type IntakeProject } from "./task-intake-parser";

const now = new Date("2026-10-27T12:00:00Z");
const projects: IntakeProject[] = [
  { id: "mos", name: "Мос.ру", aliases: ["Мосру", "mos.ru"], stage: "finished", memberIds: [] },
  // Separate fixture identity; no Моспром project is created in live CRM by these tests.
  { id: "mosprom", name: "Моспром", aliases: ["моспрому"], stage: null, memberIds: ["ilona"] },
  { id: "quercus", name: "Беседки Кверкус", aliases: ["Кверкус"], stage: "active", memberIds: ["sofa"] },
  { id: "estt", name: "ESTT", aliases: ["ИСТТ", "серверы", "ВПС", "ВДС", "VPS", "VDS"], stage: "active", memberIds: ["ilona"] },
  { id: "mm", name: "M&M Documents", aliases: ["ММ Документс"], stage: "active", memberIds: ["inna"] },
  { id: "tt", name: "Team Trip", aliases: ["Тим Трип"], stage: "active", memberIds: ["ilona"] },
  { id: "st", name: "Stroyteam77", aliases: ["Стройтим"], stage: "active", memberIds: ["ekat"] },
  { id: "kol", name: "Колвика", aliases: ["Kolvika"], stage: "active", memberIds: ["sofa"] },
  { id: "prin", name: "Манифест / Прин", aliases: ["Прин"], stage: "active", memberIds: ["ilona"] },
];
const profiles = [
  { id: "ilona", name: "Илона", aliases: ["Илоне", "Илону"] },
  { id: "inna", name: "Инна", aliases: ["Инне", "Инну"] },
  { id: "sofa", name: "Софа", aliases: ["Софе", "Софу"] },
  { id: "ekat", name: "Екатерина", aliases: ["Екатерине", "Екатерину"] },
  { id: "alena", name: "Алёна", aliases: ["Алёне", "Алёну"] },
];

describe("owner task intake — exact owner examples", () => {
  it("Илоне по моспрому до пятницы отчёт", () => {
    const task = parseIntakeTask("Илоне по моспрому до пятницы отчёт", projects, profiles, now);
    expect(task).toMatchObject({ projectId: "mosprom", assigneeId: "ilona", dueDate: "2026-10-30", deadlineKnown: true, title: "отчёт" });
  });
  it("завтра Софе выгрузить лиды Кверкус", () => {
    expect(parseIntakeTask("завтра Софе выгрузить лиды Кверкус", projects, profiles, now)).toMatchObject({ projectId: "quercus", assigneeId: "sofa", dueDate: "2026-10-28", title: "выгрузить лиды" });
  });
});

// Additional regression phrases use real CRM names/task titles; they are not
// presented as verbatim quotations of the owner's speech.
describe("task intake — regression phrases grounded in CRM", () => {
  const examples = [
    ["Инне M&M Documents сегодня отчёт", "mm", "inna", "2026-10-27"],
    ["Илоне ESTT завтра отчёт к утру", "estt", "ilona", "2026-10-28"],
    ["Софе по Кверкус послезавтра выгрузить лиды", "quercus", "sofa", "2026-10-29"],
    ["Екатерине Стройтим в пятницу проверить лендинг", "st", "ekat", "2026-10-30"],
    ["Алёне Team Trip через 3 дня подготовить материалы", "tt", "alena", "2026-10-30"],
    ["Алене Тим Трип до 15-го проверить заявки", "tt", "alena", "2026-11-15"],
    ["Илоне Прин до 15.11 отчёт", "prin", "ilona", "2026-11-15"],
    ["Инне ММ Документс в среду обновить статус", "mm", "inna", "2026-10-28"],
    ["Софе Колвика в четверг проверить цели", "kol", "sofa", "2026-10-29"],
    ["Илоне Team Trip в понедельник проверить заявки", "tt", "ilona", "2026-11-02"],
    ["Екатерине Стройтим во вторник обновить статус", "st", "ekat", "2026-10-27"],
    ["Инне M&M Documents в субботу сделать отчёт", "mm", "inna", "2026-10-31"],
    ["Софе Kolvika в воскресенье собрать данные", "kol", "sofa", "2026-11-01"],
    ["Илоне ESTT через 1 день отчёт", "estt", "ilona", "2026-10-28"],
    ["Алёне Team Trip через 5 дней проверить материалы", "tt", "alena", "2026-11-01"],
    ["Илоне Моспром до 31-го отчёт", "mosprom", "ilona", "2026-10-31"],
    ["Софе Кверкус без срока подготовить список лидов", "quercus", "sofa", null],
    ["ИЛОНЕ ESTT ЗАВТРА ОТЧЁТ", "estt", "ilona", "2026-10-28"],
  ] as const;
  it.each(examples)("%s", (source, projectId, assigneeId, dueDate) => {
    expect(parseIntakeTask(source, projects, profiles, now)).toMatchObject({ projectId, assigneeId, dueDate, deadlineKnown: true });
  });
  it("asks for a missing deadline", () => expect(parseIntakeTask("Илоне ESTT подготовить отчёт", projects, profiles, now).deadlineKnown).toBe(false));
  it("keeps a description and links", () => {
    expect(parseIntakeTask("Илоне ESTT завтра отчёт. Добавить данные: https://example.com/report. Проверить лиды.", projects, profiles, now)).toMatchObject({ title: "отчёт", description: "Добавить данные: https://example.com/report. Проверить лиды." });
  });
  it("splits lines and и ещё", () => expect(splitIntakeTasks("Илоне ESTT завтра отчёт\nСофе Кверкус сегодня лиды и ещё Инне M&M Documents в пятницу статус")).toHaveLength(3));
  it("does not split a URL with и in its path", () => expect(splitIntakeTasks("Илоне ESTT завтра отчёт https://example.com/и-ещё")).toHaveLength(1));
  it("suggests a one-letter typo without choosing", () => {
    const hits = matchIntakeEntities("Софе Кверку завтра лиды", projects);
    expect(hits[0].id).toBe("quercus"); expect(uniqueExactIntakeMatch(hits)).toBeNull();
  });
  it("suggests a two-letter typo without choosing", () => {
    const hits = matchIntakeEntities("Илоне моспрмм завтра отчёт", projects);
    expect(hits[0].id).toBe("mosprom"); expect(uniqueExactIntakeMatch(hits)).toBeNull();
  });
  it("does not match a short alias inside another word", () => expect(parseIntakeTask("Илоне завтра принести отчёт", projects, profiles, now).projectId).toBeNull());
  it("does not choose between two explicitly named projects", () => expect(parseIntakeTask("Илоне ESTT и Team Trip завтра отчёт", projects, profiles, now).projectId).toBeNull());
  it("does not choose an unknown employee", () => expect(parseIntakeTask("Мише ESTT завтра отчёт", projects, profiles, now).assigneeId).toBeNull());
});

describe("calendar deadlines", () => {
  it("uses Moscow at the UTC day boundary", () => expect(parseIntakeDeadline("сегодня", new Date("2026-10-27T22:00:00Z")).date).toBe("2026-10-28"));
  it("rolls an unqualified date to next year", () => expect(parseIntakeDeadline("15.01", now).date).toBe("2027-01-15"));
  it("rejects 31 November", () => expect(parseIntakeDeadline("31.11", now).known).toBe(false));
  it("asks when two deadlines conflict", () => expect(parseIntakeDeadline("завтра или в пятницу", now).known).toBe(false));
  it("asks when no-deadline conflicts with a date", () => expect(parseIntakeDeadline("без срока завтра", now).known).toBe(false));
  it("rejects an impossible numbered day rather than normalizing it", () => expect(parseIntakeDeadline("до 32-го", now).known).toBe(false));
  it("normalizes case and ё", () => expect(normalizeIntakeText("АЛЁНЕ — Мос.РУ")).toBe("алене мос ру"));
  it("recognizes adjacent swaps", () => expect(intakeDistance("кверкус", "кверксу")).toBe(1));
});

describe("owner alias corrections, 27 October", () => {
  const correctedProjects: IntakeProject[] = [
    ...projects,
    { id: "ans", name: "Ansaligy", aliases: ["Ансалиджи"], stage: "active", memberIds: [] },
    { id: "boards", name: "Электроника", aliases: ["Системные решения", "системайс", "платы", "печатные платы"], stage: "active", memberIds: [] },
  ];
  const correctedProfiles = [...profiles, { id: "owner", name: "Катерина Анисимова", aliases: ["Катерина", "Катя"] }];
  const parse = (text: string) => parseIntakeTask(text, correctedProjects, correctedProfiles, now);
  it.each(["ИСТТ", "серверы", "ВПС", "ВДС", "VPS", "VDS"])("maps %s to ESTT", (alias) => {
    expect(parse(`Илоне ${alias} завтра отчёт`).projectId).toBe("estt");
  });
  it("keeps Моспром separate from Мос.ру", () => {
    expect(parse("Илоне Моспром завтра отчёт").projectId).toBe("mosprom");
    expect(parse("Илоне Мос.ру завтра отчёт").projectId).toBe("mos");
  });
  it("asks if both separate projects are named", () => {
    expect(parse("Илоне Моспром и Мос.ру завтра отчёт").projectId).toBeNull();
  });
  it("recognizes Ансалиджи", () => expect(parse("Софе Ансалиджи завтра отчёт").projectId).toBe("ans"));
  it.each(["Системные решения", "системайс", "платы", "печатные платы"])("maps %s to Электроника", (alias) => {
    expect(parse(`Софе ${alias} завтра отчёт`).projectId).toBe("boards");
  });
  it("assigns Катя to the owner, distinct from employee Екатерина", () => {
    expect(parse("Катя ESTT завтра отчёт").assigneeId).toBe("owner");
    expect(parse("Екатерине ESTT завтра отчёт").assigneeId).toBe("ekat");
  });
  it("does not silently choose ESTT when a generic alias also names another project", () => {
    expect(parse("Илоне Ansaligy завтра проверить серверы").projectId).toBeNull();
  });
});

describe("partial CRM edits", () => {
  const current = { source: "", projectId: "estt", assigneeId: "ilona", dueDate: "2026-10-30", deadlineKnown: true, title: "Подготовить отчёт", description: "Проверить лиды" };
  const edit = (text: string) => parseIntakeEdit(text, current, projects, profiles, now);
  it("changes only the deadline", () => expect(edit("срок завтра")).toMatchObject({ ...current, source: "срок завтра", dueDate: "2026-10-28" }));
  it("changes the assignee without replacing the title", () => expect(edit("исполнитель Софа")).toMatchObject({ assigneeId: "sofa", projectId: "estt", title: current.title }));
  it("changes a project only when explicitly recognized", () => expect(edit("проект Кверкус")).toMatchObject({ projectId: "quercus", assigneeId: "ilona" }));
  it("asks rather than keeping the wrong project for ФЦК", () => expect(edit("проект ФЦК").projectId).toBeNull());
  it("asks rather than keeping the old assignee for Миша", () => expect(edit("исполнитель Миша").assigneeId).toBeNull());
  it("asks about an invalid deadline", () => expect(edit("срок 31.11").deadlineKnown).toBe(false));
  it("sets an explicit title", () => expect(edit("название: Обновить отчёт").title).toBe("Обновить отчёт"));
  it("does not interpret project mentions in a description as field changes", () => expect(edit("описание: Сравнить с Кверкус")).toMatchObject({ projectId: "estt", description: "Сравнить с Кверкус" }));
  it("can clear the description", () => expect(edit("описание:").description).toBeNull());
  it("supports an explicitly removed deadline", () => expect(edit("срок без срока")).toMatchObject({ dueDate: null, deadlineKnown: true }));
  it("asks for a title when the text contains only metadata", () => expect(parseIntakeTask("Илоне ESTT завтра", projects, profiles, now).title).toBe(""));
});
