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

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Укажите название задачи"),
  project_id: z.string().uuid("Выберите проект"),
  assignee_id: optionalUuid,
  task_type: z.enum(TASK_TYPE_VALUES),
  priority: z.enum(TASK_PRIORITY_VALUES),
  due_date: optionalString,
  description: optionalString,
  is_important: z.boolean().optional(),
  is_urgent: z.boolean().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export function flattenZodErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_root";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}
