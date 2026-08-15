import { dateISOInTimeZone } from "@/lib/calendar-events";

export const COMPLETED_TASK_RETENTION_DAYS = 3;
// Миграция 0031 и pg_cron считают срок хранения по Бангкоку. Не связываем
// эту бизнес-дату с часовым поясом отображения личного календаря.
export const COMPLETED_TASK_RETENTION_TIME_ZONE = "Asia/Bangkok";

export function completedTaskRetentionCutoffDate(now = new Date()): string {
  const today = dateISOInTimeZone(now, COMPLETED_TASK_RETENTION_TIME_ZONE);
  const cutoff = new Date(`${today}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - COMPLETED_TASK_RETENTION_DAYS);
  return cutoff.toISOString().slice(0, 10);
}

export function isCompletedTaskVisible(
  completedAt: string | null,
  now = new Date(),
): boolean {
  if (!completedAt) return false;
  const completedDate = dateISOInTimeZone(
    new Date(completedAt),
    COMPLETED_TASK_RETENTION_TIME_ZONE,
  );
  return completedDate > completedTaskRetentionCutoffDate(now);
}
