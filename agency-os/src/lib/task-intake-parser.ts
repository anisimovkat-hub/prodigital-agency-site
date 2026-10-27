/** Deterministic task intake. Fuzzy matches are suggestions, never decisions. */
export type IntakeEntity = { id: string; name: string; aliases: string[] };
export type IntakeProject = IntakeEntity & { stage: string | null; memberIds: string[]; clientName?: string | null };
export type IntakeProfile = IntakeEntity;
export type EntityMatch = { id: string; label: string; score: number; exact: boolean; phrase: string };
export type ParsedIntakeTask = {
  source: string;
  title: string;
  description: string | null;
  projectId: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  deadlineKnown: boolean;
  projectQuery?: string;
  taskId?: string;
  previewed?: boolean;
};

export function normalizeIntakeText(text: string): string {
  return text.normalize("NFKC").toLocaleLowerCase("ru-RU").replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

/** Bounded Damerau-Levenshtein handles dictation typos and adjacent swaps. */
export function intakeDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
  }
  return rows[a.length][b.length];
}

export function matchIntakeEntities(text: string, entities: IntakeEntity[]): EntityMatch[] {
  const normalized = normalizeIntakeText(text);
  const words = normalized.split(" ");
  return entities.flatMap((entity): EntityMatch[] => {
    let best: EntityMatch | null = null;
    for (const value of [entity.name, ...entity.aliases]) {
      const phrase = normalizeIntakeText(value);
      if (!phrase) continue;
      const exact = (` ${normalized} `).includes(` ${phrase} `);
      if (exact) {
        const hit = { id: entity.id, label: entity.name, score: 100 + phrase.length, exact: true, phrase };
        if (!best || hit.score > best.score) best = hit;
        continue;
      }
      if (phrase.length < 4 || phrase.length > 80) continue;
      const size = phrase.split(" ").length;
      for (let i = 0; i <= words.length - size; i++) {
        const candidate = words.slice(i, i + size).join(" ");
        if (Math.abs(candidate.length - phrase.length) > 2) continue;
        const distance = intakeDistance(candidate, phrase);
        const limit = phrase.length >= 7 ? 2 : 1;
        if (distance <= limit) {
          const hit = { id: entity.id, label: entity.name, score: 60 - distance * 10 + Math.min(phrase.length, 20), exact: false, phrase };
          if (!best || hit.score > best.score) best = hit;
        }
      }
    }
    return best ? [best] : [];
  }).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "ru"));
}

export function uniqueExactIntakeMatch(matches: EntityMatch[]): string | null {
  const exact = matches.filter((match) => match.exact);
  // A longer full name can contain a shorter alias of the same phrase. Two
  // independent project mentions still need an explicit choice.
  const distinct = exact.filter((match) => !exact.some((other) => other.id !== match.id && other.phrase !== match.phrase && (` ${other.phrase} `).includes(` ${match.phrase} `)));
  return distinct.length === 1 ? distinct[0].id : null;
}

export function moscowIntakeDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function shiftIntakeDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function calendarDate(year: number, month: number, day: number): string | null {
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day ? value.toISOString().slice(0, 10) : null;
}

export function parseIntakeDeadline(text: string, now = new Date()): { date: string | null; known: boolean; matched: string[] } {
  const today = moscowIntakeDate(now);
  const normalized = text.toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
  const dates: { date: string | null; text: string }[] = [];
  let invalid = false;
  const add = (date: string | null, value: string) => { if (!date) invalid = true; else dates.push({ date, text: value }); };
  for (const m of normalized.matchAll(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?(?!\d)/g)) {
    const year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
    let date = calendarDate(year, Number(m[2]), Number(m[1]));
    if (!m[3] && date && date < today) date = calendarDate(year + 1, Number(m[2]), Number(m[1]));
    add(date, m[0]);
  }
  for (const m of normalized.matchAll(/через\s+(\d{1,3})\s+д(?:ень|ня|ней)(?![а-я])/g)) add(shiftIntakeDate(today, Number(m[1])), m[0]);
  // Cyrillic words need Unicode-aware boundaries, not JavaScript \b.
  for (const m of normalized.matchAll(/(?<![а-я])(послезавтра|завтра|сегодня)(?![а-я])/g)) add(shiftIntakeDate(today, ({ сегодня: 0, завтра: 1, послезавтра: 2 } as Record<string, number>)[m[1]]), m[0]);
  const weekdays: [RegExp, number][] = [
    [/(?<![а-я])понедельник(?:а|у|ом)?(?![а-я])/g, 1], [/(?<![а-я])вторник(?:а|у|ом)?(?![а-я])/g, 2],
    [/(?<![а-я])сред(?:а|у|ы|е|ой)(?![а-я])/g, 3], [/(?<![а-я])четверг(?:а|у|ом)?(?![а-я])/g, 4],
    [/(?<![а-я])пятниц(?:а|у|ы|е|ей)(?![а-я])/g, 5], [/(?<![а-я])суббот(?:а|у|ы|е|ой)(?![а-я])/g, 6],
    [/(?<![а-я])воскресень(?:е|я|ю|ем)(?![а-я])/g, 0],
  ];
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  for (const [regex, day] of weekdays) for (const m of normalized.matchAll(regex)) {
    let delta = (day - weekday + 7) % 7;
    const prefix = normalized.slice(Math.max(0, m.index! - 20), m.index);
    if (/следующ\S*\s*$/.test(prefix)) delta += 7;
    add(shiftIntakeDate(today, delta), m[0]);
  }
  for (const m of normalized.matchAll(/до\s+(\d{1,2})\s*-?\s*(?:го|числа)(?![а-я])/g)) {
    let year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
    if (Number(m[1]) < Number(today.slice(8))) { month++; if (month === 13) { month = 1; year++; } }
    add(calendarDate(year, month, Number(m[1])), m[0]);
  }
  const noDate = /(?<![а-я])без\s+срока(?![а-я])/.test(normalized);
  const distinct = new Set(dates.map((entry) => entry.date));
  if (invalid || distinct.size > 1 || (noDate && dates.length > 0)) return { date: null, known: false, matched: [] };
  return { date: dates[0]?.date ?? null, known: noDate || distinct.size === 1, matched: dates.map((entry) => entry.text) };
}

export function splitIntakeTasks(text: string): string[] {
  return text.split(/\r?\n|(?<![а-я])и\s+ещ[её](?![а-я])/iu).map((line) => line.replace(/^\s*(?:[-•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
}

export function parseIntakeTask(source: string, projects: IntakeProject[], profiles: IntakeProfile[], now = new Date()): ParsedIntakeTask {
  const projectMatches = matchIntakeEntities(source, projects);
  const profileMatches = matchIntakeEntities(source, profiles);
  const projectId = uniqueExactIntakeMatch(projectMatches);
  const assigneeId = uniqueExactIntakeMatch(profileMatches);
  const deadline = parseIntakeDeadline(source, now);
  const phrases = [projectMatches.find((m) => m.id === projectId)?.phrase, profileMatches.find((m) => m.id === assigneeId)?.phrase].filter((p): p is string => Boolean(p));
  let body = source;
  // Replace only recognized metadata in the first phrase. Keep descriptions,
  // numbers and links verbatim; periods inside URLs/dates are not sentences.
  const boundary = body.search(/[.!?](?=\s|$)/u);
  let first = boundary >= 0 ? body.slice(0, boundary) : body;
  const description = boundary >= 0 ? body.slice(boundary + 1).trim() || null : null;
  for (const phrase of phrases.sort((a, b) => b.length - a.length)) {
    const pattern = phrase.split(" ").map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll("е", "[её]")).join("[^\\p{L}\\p{N}]+");
    first = first.replace(new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "iu"), " ");
  }
  for (const phrase of deadline.matched) first = first.replace(new RegExp(`(?<![\\p{L}\\p{N}])(?:(?:до|к|в|во|на)\\s+)?${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "iu"), " ");
  first = first.replace(/(?:^|\s)(?:по|для|до|к|на|в)\s*(?=$|[,;])/giu, " ").replace(/\s+/g, " ").replace(/^[\s,;:—-]+|[\s,;:—-]+$/g, "").trim()
    .replace(/^(?:(?:по|для|до|к|на|в)\s+)+/iu, "");
  body = first;
  return { source, title: body.slice(0, 200), description, projectId, assigneeId, dueDate: deadline.date, deadlineKnown: deadline.known };
}

export function parseIntakeEdit(source: string, current: ParsedIntakeTask, projects: IntakeProject[], profiles: IntakeProfile[], now = new Date()): ParsedIntakeTask {
  const title = source.match(/^название\s*:\s*([\s\S]*)/iu);
  const description = source.match(/^описание\s*:\s*([\s\S]*)/iu);
  const base = { source, title: current.title, description: current.description, projectId: current.projectId, assigneeId: current.assigneeId, dueDate: current.dueDate, deadlineKnown: current.deadlineKnown };
  if (title) return { ...base, title: title[1].trim().slice(0, 200) };
  if (description) return { ...base, description: description[1].trim() || null };
  const parsed = parseIntakeTask(source, projects, profiles, now);
  const requestedProject = /^проект\s*[:—-]?\s/iu.test(source);
  const requestedAssignee = /^(?:исполнитель|кому)\s*[:—-]?\s/iu.test(source);
  const requestedDeadline = /^(?:срок|дедлайн)\s*[:—-]?\s/iu.test(source);
  const ambiguousProject = matchIntakeEntities(source, projects).filter((m) => m.exact).length > 1;
  const ambiguousAssignee = matchIntakeEntities(source, profiles).filter((m) => m.exact).length > 1;
  return { ...base,
    projectId: requestedProject || ambiguousProject ? parsed.projectId : parsed.projectId ?? base.projectId,
    assigneeId: requestedAssignee || ambiguousAssignee ? parsed.assigneeId : parsed.assigneeId ?? base.assigneeId,
    dueDate: requestedDeadline || parsed.deadlineKnown ? parsed.dueDate : base.dueDate,
    deadlineKnown: requestedDeadline ? parsed.deadlineKnown : parsed.deadlineKnown || base.deadlineKnown,
    title: !requestedProject && !requestedAssignee && !requestedDeadline && parsed.title && parsed.title !== source.trim() ? parsed.title : base.title,
    description: parsed.description ?? base.description,
  };
}
