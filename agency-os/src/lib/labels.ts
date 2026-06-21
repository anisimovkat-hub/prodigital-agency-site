import type { Enums } from "@/lib/supabase/types";

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
  paused: "На паузе",
  finished: "Завершён",
};

export const CLIENT_STATUS_LABEL: Record<Enums<"client_status">, string> = {
  active: "Активен",
  paused: "Пауза",
  churned: "Отток",
};

export const TASK_STATUS_LABEL: Record<Enums<"task_status">, string> = {
  backlog: "Бэклог",
  todo: "К выполнению",
  in_progress: "В работе",
  review: "На проверке",
  done: "Сделано",
  paused: "На паузе",
};

export const TASK_PRIORITY_LABEL: Record<Enums<"task_priority">, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
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
