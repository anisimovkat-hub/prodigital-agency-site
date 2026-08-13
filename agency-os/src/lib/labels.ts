import type { Enums } from "@/lib/supabase/types";
import type { RecurringFrequency } from "@/lib/validation";

export const MEDIA_PLAN_STATUS_LABEL = {
  draft: "Черновик",
  approved: "Утверждён",
  archived: "Архив",
} as const;

export const MEDIA_PLAN_METRIC_LABEL: Record<string, string> = {
  spend: "Рекламный бюджет",
  impressions: "Показы",
  clicks: "Клики",
  reach: "Охват",
  revenue: "Выручка",
};

export const PROJECT_HEALTH_LABEL: Record<
  Enums<"project_health">,
  string
> = {
  green: "Норм",
  yellow: "Внимание",
  red: "Критично",
};

export const PROJECT_STAGE_LABEL: Record<Enums<"project_stage">, string> = {
  active: "Активен",
  launching: "На запуске",
  paused: "На паузе",
  finished: "Завершён",
};

export const PROJECT_OWNERSHIP_MODE_LABEL: Record<string, string> = {
  self: "Веду сама",
  delegated: "Делегирован",
  launching: "На запуске",
  testing: "Тест / под вопросом",
  one_off: "Разовый",
  needs_owner: "Нужен ответственный",
};

export const CLIENT_STATUS_LABEL: Record<Enums<"client_status">, string> = {
  active: "Активен",
  paused: "Пауза",
  churned: "Завершён",
};

export const TASK_STATUS_LABEL: Record<Enums<"task_status">, string> = {
  backlog: "Бэклог",
  todo: "К выполнению",
  in_progress: "В работе",
  ai_wait: "Ждём ИИ",
  review: "На проверке",
  done: "Сделано",
  paused: "На паузе",
  cancelled: "Отменена",
};

export const TASK_PRIORITY_LABEL: Record<Enums<"task_priority">, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

export const PRIORITY_ACCENT: Record<Enums<"task_priority">, string> = {
  urgent: "border-l-red-500",
  high: "border-l-amber-500",
  medium: "border-l-blue-500",
  low: "border-l-neutral-300",
};

export const TASK_TYPE_LABEL: Record<Enums<"task_type">, string> = {
  ads: "Реклама",
  creative: "Креатив",
  analytics: "Аналитика",
  website: "Сайт",
  content: "Контент",
  report: "Отчёт",
  communication: "Коммуникация",
  other: "Другое",
};

export const NOTE_TYPE_LABEL: Record<Enums<"note_type">, string> = {
  hypothesis: "Гипотезы",
  risk: "Риски",
  history: "История изменений",
  client_note: "Заметки по клиенту",
};

export const USER_ROLE_LABEL: Record<Enums<"user_role">, string> = {
  owner: "Владелец",
  pm: "Проект-менеджер",
  specialist: "Специалист",
  viewer: "Наблюдатель",
};

export const RECURRING_FREQUENCY_LABEL: Record<
  RecurringFrequency,
  string
> = {
  daily: "Каждый день",
  every_other_day: "Через день",
  weekly: "По дням недели",
};

export const WEEKDAY_LABEL: Record<number, string> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
  0: "Вс",
};
