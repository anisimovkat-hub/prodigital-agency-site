export type TaskTimeEntry = {
  id: string;
  task_id: string;
  task_title: string;
  task_type: string | null;
  workstream: string | null;
  project_id: string | null;
  user_id: string | null;
  started_at: string;
  ended_at: string | null;
};

export type TimeAllocation = {
  totalSeconds: number;
  byTaskSeconds: Map<string, number>;
  byProjectSeconds: Map<string, number>;
  rawByTaskSeconds: Map<string, number>;
};

type TimeRange = {
  from: Date;
  to: Date;
  now?: Date;
};

type ClippedEntry = TaskTimeEntry & {
  startMs: number;
  endMs: number;
};

/**
 * Распределяет пересекающееся время одного сотрудника поровну между задачами.
 * Так две параллельные задачи за один час дают по 30 минут, а не два часа работы.
 */
export function allocateTaskTime(
  entries: TaskTimeEntry[],
  { from, to, now = new Date() }: TimeRange,
): TimeAllocation {
  const fromMs = from.getTime();
  const toMs = Math.min(to.getTime(), now.getTime());
  const clipped = entries.flatMap((entry): ClippedEntry[] => {
    const startMs = Math.max(fromMs, new Date(entry.started_at).getTime());
    const naturalEnd = entry.ended_at
      ? new Date(entry.ended_at).getTime()
      : now.getTime();
    const endMs = Math.min(toMs, naturalEnd);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      return [];
    }
    return [{ ...entry, startMs, endMs }];
  });

  const rawByTaskMs = new Map<string, number>();
  for (const entry of clipped) {
    add(rawByTaskMs, entry.task_id, entry.endMs - entry.startMs);
  }

  const byWorker = Map.groupBy(clipped, (entry) =>
    entry.user_id ? `user:${entry.user_id}` : `task:${entry.task_id}`,
  );
  const byTaskMs = new Map<string, number>();
  const byProjectMs = new Map<string, number>();
  let totalMs = 0;

  for (const workerEntries of byWorker.values()) {
    const boundaries = [
      ...new Set(
        workerEntries.flatMap((entry) => [entry.startMs, entry.endMs]),
      ),
    ].sort((a, b) => a - b);

    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const segmentStart = boundaries[index];
      const segmentEnd = boundaries[index + 1];
      const segmentMs = segmentEnd - segmentStart;
      if (segmentMs <= 0) continue;

      const active = workerEntries.filter(
        (entry) => entry.startMs < segmentEnd && entry.endMs > segmentStart,
      );
      if (active.length === 0) continue;

      const shareMs = segmentMs / active.length;
      totalMs += segmentMs;
      for (const entry of active) {
        add(byTaskMs, entry.task_id, shareMs);
        if (entry.project_id) add(byProjectMs, entry.project_id, shareMs);
      }
    }
  }

  return {
    totalSeconds: toSeconds(totalMs),
    byTaskSeconds: secondsMap(byTaskMs),
    byProjectSeconds: secondsMap(byProjectMs),
    rawByTaskSeconds: secondsMap(rawByTaskMs),
  };
}

export function sumRawTaskTime(
  entries: Pick<TaskTimeEntry, "task_id" | "started_at" | "ended_at">[],
  now: Date = new Date(),
): Map<string, number> {
  const result = new Map<string, number>();
  for (const entry of entries) {
    const startedAt = new Date(entry.started_at).getTime();
    const endedAt = entry.ended_at
      ? new Date(entry.ended_at).getTime()
      : now.getTime();
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) continue;
    add(result, entry.task_id, Math.max(0, endedAt - startedAt) / 1_000);
  }
  return result;
}

function add(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function secondsMap(source: Map<string, number>): Map<string, number> {
  return new Map(
    [...source].map(([key, milliseconds]) => [
      key,
      toSeconds(milliseconds),
    ]),
  );
}

function toSeconds(milliseconds: number): number {
  return Math.round(milliseconds / 1_000);
}
