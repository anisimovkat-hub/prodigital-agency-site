import { matchIntakeEntities, moscowIntakeDate, parseIntakeDeadline, shiftIntakeDate, type IntakeProfile, type IntakeProject, type ParsedIntakeTask } from "./task-intake-parser";

export type IntakeCatalog = { projects: IntakeProject[]; profiles: IntakeProfile[] };
export type IntakeChoice = { id: string; label: string };
export type IntakeQuestion = { field: "title" | "project" | "assignee" | "deadline"; choices: IntakeChoice[]; prompt: string };

/** Shared by the live bot and the owner-only preview rehearsal. */
export function nextIntakeQuestion(item: ParsedIntakeTask, data: IntakeCatalog, now = new Date()): IntakeQuestion | null {
  if (!item.title.trim()) return { field: "title", choices: [], prompt: "Что нужно сделать? Напишите название задачи." };
  if (!item.projectId) {
    const query = item.projectQuery ?? item.source;
    const clientMatches = data.projects.filter((p) => p.clientName && matchIntakeEntities(query, [{ id: p.id, name: p.clientName, aliases: [] }]).some((m) => m.exact));
    const hits = matchIntakeEntities(query, data.projects);
    const suggestions = clientMatches.length ? clientMatches.map((p) => ({ id: p.id, label: p.name })) : hits;
    const choices = (suggestions.length ? suggestions : data.projects.filter((p) => ["active", "launching"].includes(p.stage ?? "")).map((p) => ({ id: p.id, label: p.name }))).slice(0, 3).map((p) => ({ id: p.id, label: p.label }));
    return { field: "project", choices: [...choices, { id: "other", label: "Другой" }], prompt: "Какой проект?" };
  }
  const project = data.projects.find((p) => p.id === item.projectId);
  if (!project || !["active", "launching"].includes(project.stage ?? "")) return { field: "project", choices: [{ id: "other", label: "Выбрать другой проект" }], prompt: "Проект на паузе или завершён. Выберите другой проект или отмените задачу." };
  if (!item.assigneeId || !data.profiles.some((p) => p.id === item.assigneeId)) {
    const members = data.profiles.filter((p) => project.memberIds.includes(p.id));
    const choices = (members.length ? members : data.profiles).map((p) => ({ id: p.id, label: p.name }));
    if (members.length) choices.push({ id: "other", label: "Другой сотрудник" });
    return { field: "assignee", choices, prompt: "Кому?" };
  }
  if (!item.deadlineKnown) {
    const today = moscowIntakeDate(now);
    return { field: "deadline", choices: [{ id: today, label: "Сегодня" }, { id: shiftIntakeDate(today, 1), label: "Завтра" }, { id: parseIntakeDeadline("пятница", now).date!, label: "Пятница" }, { id: "none", label: "Без срока" }], prompt: "Срок? Можно выбрать кнопку или написать дату." };
  }
  return null;
}

export function chooseIntakeField(item: ParsedIntakeTask, field: IntakeQuestion["field"], value: string): ParsedIntakeTask {
  if (field === "project") return { ...item, projectId: value };
  if (field === "assignee") return { ...item, assigneeId: value };
  if (field === "deadline") return { ...item, dueDate: value === "none" ? null : value, deadlineKnown: true };
  return { ...item, title: value.trim().slice(0, 200) };
}
