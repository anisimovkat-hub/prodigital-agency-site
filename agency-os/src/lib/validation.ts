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

const optionalUrl = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}, z.string().url("Укажите корректную ссылку").optional());

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

export const MEDIA_PLAN_STATUS_VALUES = ["draft", "approved", "archived"] as const;
export const MEDIA_PLAN_SOURCE_VALUES = ["manual", "google_sheets"] as const;

export const mediaPlanSchema = z
  .object({
    project_id: z.string().uuid("Выберите проект"),
    workstream: optionalString,
    period_start: z.string().date("Укажите начало периода"),
    period_end: z.string().date("Укажите конец периода"),
    name: z.string().trim().min(1, "Укажите название медиаплана"),
    status: z.enum(MEDIA_PLAN_STATUS_VALUES),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Укажите код валюты из трёх букв"),
    source_type: z.enum(MEDIA_PLAN_SOURCE_VALUES),
    source_url: optionalUrl,
    source_range: optionalString,
  })
  .superRefine((value, context) => {
    if (value.period_end < value.period_start) {
      context.addIssue({ code: "custom", path: ["period_end"], message: "Конец периода раньше начала" });
    }
    if (value.source_type === "google_sheets" && !value.source_url) {
      context.addIssue({ code: "custom", path: ["source_url"], message: "Вставьте ссылку Google Sheets" });
    }
    if (value.source_type === "google_sheets" && !value.source_range?.trim()) {
      context.addIssue({ code: "custom", path: ["source_range"], message: "Укажите диапазон листа" });
    }
  });

export type MediaPlanInput = z.infer<typeof mediaPlanSchema>;

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
  "todo",
  "in_progress",
  "ai_wait",
  "review",
  "paused",
  "done",
  "cancelled",
] as const;

export const RECURRING_FREQUENCY_VALUES = [
  "daily",
  "every_other_day",
  "weekly",
] as const;

export type RecurringFrequency =
  (typeof RECURRING_FREQUENCY_VALUES)[number];

const recurringWeekdaysSchema = z
  .array(z.coerce.number().int().min(0).max(6))
  .optional();

export const createRecurringTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Укажите название задачи"),
    project_id: optionalUuid,
    workstream: optionalString,
    assignee_id: optionalUuid,
    task_type: z.enum(TASK_TYPE_VALUES),
    priority: z.enum(TASK_PRIORITY_VALUES),
    frequency: z.enum(RECURRING_FREQUENCY_VALUES),
    weekdays: recurringWeekdaysSchema,
    anchor_date: z.string().min(1, "Укажите дату отсчёта"),
  })
  .superRefine((value, context) => {
    if (value.frequency === "weekly" && !value.weekdays?.length) {
      context.addIssue({
        code: "custom",
        path: ["weekdays"],
        message: "Выберите хотя бы один день недели",
      });
    }
  });

export const updateRecurringScheduleSchema = z
  .object({
    id: z.string().uuid("Некорректный шаблон"),
    frequency: z.enum(RECURRING_FREQUENCY_VALUES),
    weekdays: recurringWeekdaysSchema,
    anchor_date: z.string().min(1, "Укажите дату отсчёта"),
  })
  .superRefine((value, context) => {
    if (value.frequency === "weekly" && !value.weekdays?.length) {
      context.addIssue({
        code: "custom",
        path: ["weekdays"],
        message: "Выберите хотя бы один день недели",
      });
    }
  });

export const toggleRecurringTaskSchema = z.object({
  id: z.string().uuid("Некорректный шаблон"),
  is_active: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
});

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

export const updateTaskDueDateSchema = z.object({
  id: z.string().uuid("Некорректный идентификатор задачи"),
  due_date: optionalString,
});

export const updateTaskQuickFieldSchema = z.discriminatedUnion("field", [
  z.object({
    id: z.string().uuid("Некорректный идентификатор задачи"),
    field: z.literal("priority"),
    value: z.enum(TASK_PRIORITY_VALUES),
  }),
  z.object({
    id: z.string().uuid("Некорректный идентификатор задачи"),
    field: z.literal("assignee_id"),
    value: optionalUuid,
  }),
]);

export const reorderBoardTasksSchema = z.object({
  task_ids: z
    .array(z.string().uuid("Некорректный идентификатор задачи"))
    .min(1, "Передайте хотя бы одну задачу")
    .max(500, "Слишком много задач для одного перемещения")
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Список задач содержит дубли",
    }),
  moved_task_id: z.string().uuid("Некорректный идентификатор задачи"),
  status: z.enum([
    "todo",
    "in_progress",
    "ai_wait",
    "paused",
    "review",
    "done",
  ]),
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
export const PROJECT_STAGE_VALUES = [
  "launching",
  "active",
  "paused",
  "finished",
] as const;
export const updateProjectQuickFieldSchema = z.discriminatedUnion("field", [
  z.object({
    id: z.string().uuid("Некорректный проект"),
    field: z.literal("health"),
    value: z.enum(PROJECT_HEALTH_VALUES),
  }),
  z.object({
    id: z.string().uuid("Некорректный проект"),
    field: z.literal("stage"),
    value: z.enum(PROJECT_STAGE_VALUES),
  }),
]);
export const PROJECT_OWNERSHIP_MODE_VALUES = [
  "self",
  "delegated",
  "launching",
  "testing",
  "one_off",
  "needs_owner",
] as const;

const optionalOwnershipMode = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.enum(PROJECT_OWNERSHIP_MODE_VALUES).optional(),
);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Укажите название проекта"),
  client_id: z.string().uuid("Выберите клиента"),
  health: z.enum(PROJECT_HEALTH_VALUES),
  stage: z.enum(PROJECT_STAGE_VALUES),
  budget: optionalNonNegativeNumber,
  monthly_fee: optionalNonNegativeNumber,
  ownership_mode: optionalOwnershipMode,
  responsible_id: optionalUuid,
  short_comment: optionalString,
  logo_url: optionalUrl,
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
