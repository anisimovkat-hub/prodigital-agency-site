import {
  dateISOInTimeZone,
  PERSONAL_CALENDAR_TIME_ZONE,
} from "@/lib/calendar-events";

export const COMPLETED_TASK_RETENTION_DAYS = 3;

export function completedTaskRetentionCutoffDate(now = new Date()): string {
  const today = dateISOInTimeZone(now, PERSONAL_CALENDAR_TIME_ZONE);
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
    PERSONAL_CALENDAR_TIME_ZONE,
  );
  return completedDate > completedTaskRetentionCutoffDate(now);
}
