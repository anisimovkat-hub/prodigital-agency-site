import { z } from "zod";

const optionalNonNegativeNumber = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}, z.coerce.number({ message: "Введите число" }).nonnegative("Не может быть отрицательным").optional());

const optionalUuid = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}, z.string().uuid("Некорректный идентификатор").optional());

const optionalString = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}, z.string().optional());

export const estimateMinutesFromHoursSchema = z
  .preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      return value;
    },
    z.coerce
      .number({ message: "Введите число" })
      .nonnegative("Оценка не может быть отрицательной")
      .optional(),
  )
  .transform((hours) => (hours === undefined ? null : Math.round(hours * 60)));

export const kpiEntrySchema = z.object({
  entry_date: z.string().min(1, "Укажите дату"),
  spend: optionalNonNegativeNumber,
  impressions: optionalNonNegativeNumber,
  clicks: optionalNonNegativeNumber,
  leads: optionalNonNegativeNumber,
  sales: optionalNonNegativeNumber,
  revenue: optionalNonNegativeNumber,
  comment: optionalString,
});

export type KpiEntryInput = z.infer<typeof kpiEntrySchema>;

export const TASK_PRIORITY_VALUES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const TASK_TYPE_VALUES = [
  "ads",
  "creative",
  "analytics",
  "website",
  "content",
  "report",
  "communication",
  "other",
] as const;

export const TASK_STATUS_VALUES = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "paused",
  "done",
] as const;

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Укажите название задачи"),
  project_id: z.string().uuid("Выберите проект"),
  assignee_id: optionalUuid,
  task_type: z.enum(TASK_TYPE_VALUES),
  priority: z.enum(TASK_PRIORITY_VALUES),
  due_date: optionalString,
  estimate_minutes: estimateMinutesFromHoursSchema,
  workstream: optionalString,
  description: optionalString,
  is_important: z.boolean().optional(),
  is_urgent: z.boolean().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  id: z.string().uuid("Некорректный идентификатор задачи"),
  title: z.string().trim().min(1, "Укажите название задачи"),
  project_id: optionalUuid,
  assignee_id: optionalUuid,
  status: z.enum(TASK_STATUS_VALUES),
  task_type: z.enum(TASK_TYPE_VALUES),
  priority: z.enum(TASK_PRIORITY_VALUES),
  due_date: optionalString,
  estimate_minutes: estimateMinutesFromHoursSchema,
  workstream: optionalString,
  description: optionalString,
  is_important: z.boolean().optional(),
  is_urgent: z.boolean().optional(),
});

export const createSubtaskSchema = z.object({
  parent_task_id: z.string().uuid("Некорректная родительская задача"),
  title: z.string().trim().min(1, "Укажите название подзадачи"),
  assignee_id: optionalUuid,
  due_date: optionalString,
});

export const taskChecklistItemSchema = z.object({
  task_id: z.string().uuid("Некорректная задача"),
  title: z.string().trim().min(1, "Напишите пункт чеклиста"),
});

export const taskCommentSchema = z.object({
  task_id: z.string().uuid("Некорректная задача"),
  body: z.string().trim().min(1, "Напишите комментарий"),
});

export const taskAttachmentSchema = z.object({
  task_id: z.string().uuid("Некорректная задача"),
  attachment_id: optionalUuid,
  title: optionalString,
  url: z.string().trim().url("Укажите корректную ссылку"),
});

export const CLIENT_STATUS_VALUES = ["active", "paused", "churned"] as const;

const optionalEmail = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}, z.string().email("Некорректный email").optional());

export const createClientSchema = z.object({
  name: z.string().trim().min(1, "Укажите название клиента"),
  status: z.enum(CLIENT_STATUS_VALUES),
  budget: optionalNonNegativeNumber,
  phone: optionalString,
  email: optionalEmail,
  telegram: optionalString,
  notes: optionalString,
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const PROJECT_HEALTH_VALUES = ["green", "yellow", "red"] as const;
export const PROJECT_STAGE_VALUES = ["active", "paused", "finished"] as const;

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Укажите название проекта"),
  client_id: z.string().uuid("Выберите клиента"),
  health: z.enum(PROJECT_HEALTH_VALUES),
  stage: z.enum(PROJECT_STAGE_VALUES),
  budget: optionalNonNegativeNumber,
  responsible_id: optionalUuid,
  short_comment: optionalString,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export function flattenZodErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_root";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}
