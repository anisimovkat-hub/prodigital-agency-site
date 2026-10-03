export type AudienceGoalRow = {
  breakdown: "age" | "gender" | "country" | "region" | "publisher_platform";
  value: string;
  spend: number | null;
  conversion_actions: unknown;
};

export type AudienceGoalSlice = {
  value: string;
  spend: number | null;
  results: number | null;
  cpa: number | null;
  complete: boolean;
};

function countGoal(actions: unknown, goal: string): number | null {
  if (!Array.isArray(actions)) return null;
  return actions.reduce<number>((total, action) => {
    if (!action || typeof action !== "object" || action.actionType !== goal) return total;
    const count = Number(action.count);
    return Number.isFinite(count) ? total + count : total;
  }, 0);
}

export function summarizeAudienceGoal(
  rows: AudienceGoalRow[],
  breakdown: AudienceGoalRow["breakdown"],
  goal: string | null,
): AudienceGoalSlice[] {
  const totals = new Map<string, { spend: number; results: number; complete: boolean }>();
  for (const row of rows) {
    if (row.breakdown !== breakdown) continue;
    const result = goal ? countGoal(row.conversion_actions, goal) : null;
    const current = totals.get(row.value) ?? { spend: 0, results: 0, complete: true };
    if (row.spend === null || result === null) current.complete = false;
    else {
      current.spend += row.spend;
      current.results += result;
    }
    totals.set(row.value, current);
  }
  return [...totals.entries()].map(([value, total]) => ({
    value,
    spend: total.complete ? total.spend : null,
    results: total.complete ? total.results : null,
    cpa: total.complete && total.results > 0 ? total.spend / total.results : null,
    complete: total.complete,
  })).sort((a, b) => {
    if (a.cpa === null) return 1;
    if (b.cpa === null) return -1;
    return a.cpa - b.cpa;
  });
}
