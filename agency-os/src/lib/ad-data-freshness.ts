function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

export type AdSourceState = "ok" | "error" | "paused" | "no_results" | "not_loaded";
export type AdSourceStatus = { state: AdSourceState; message: string | null };

type SourceAccount = { platform: string; last_sync_at: string | null; last_sync_error: string | null };

/**
 * One honest status per project's ad sources:
 * - error: a load really failed, or the daily load has not run for two days;
 * - paused: Meta confirms no active campaigns, so missing days are expected;
 * - no_results: loads succeed but nothing ran in the selected period;
 * - not_loaded: accounts were never loaded.
 */
export function describeAdSourceStatus({ accounts, campaignStatuses, latestDate, hasDataInPeriod, now = new Date() }: {
  accounts: SourceAccount[];
  campaignStatuses: (string | null)[];
  latestDate: string | null;
  hasDataInPeriod: boolean;
  now?: Date;
}): AdSourceStatus {
  if (!accounts.length) return { state: "ok", message: null };
  const failed = accounts.find((account) => account.last_sync_error);
  if (failed) return { state: "error", message: `Ошибка загрузки: ${failed.last_sync_error}` };
  const lastSync = accounts.reduce<number | null>((latest, account) => {
    const time = account.last_sync_at ? Date.parse(account.last_sync_at) : NaN;
    return Number.isFinite(time) && (latest === null || time > latest) ? time : latest;
  }, null);
  if (lastSync === null) {
    return latestDate ? { state: "ok", message: null } : { state: "not_loaded", message: "Статистика кабинетов ещё не загружалась." };
  }
  if (now.getTime() - lastSync > 2 * 86_400_000) {
    return { state: "error", message: `Ошибка загрузки: автоматическое обновление не запускалось с ${formatDate(new Date(lastSync).toISOString().slice(0, 10))}.` };
  }
  if (hasDataInPeriod) return { state: "ok", message: null };
  const metaOnly = accounts.every((account) => account.platform === "meta");
  const anyActive = campaignStatuses.some((status) => status === "ACTIVE");
  if (metaOnly && campaignStatuses.length && !anyActive) {
    return { state: "paused", message: `Реклама выключена${latestDate ? `: последние показы ${formatDate(latestDate)}` : ""}.` };
  }
  return { state: "no_results", message: "Нет показов за выбранный период: загрузка прошла успешно." };
}
