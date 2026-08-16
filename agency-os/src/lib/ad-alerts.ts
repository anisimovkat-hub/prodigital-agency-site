import type { ProjectAdMetrics } from "@/lib/dashboard-ad-metrics";

export const AD_ALERT_THRESHOLDS = {
  costIncreaseRatio: 0.2,
  noResultsDays: 14,
  minimumSpendWithoutResults: 1,
} as const;

export type AdAlert = {
  id: string;
  projectId: string;
  projectName: string;
  kind:
    | "cost-increase"
    | "spend-without-results"
    | "no-results";
  severity: "red" | "amber";
  title: string;
  detail: string;
  href: string;
};

type AdAlertProject = { id: string; name: string };

type BuildAdAlertsInput = {
  projects: AdAlertProject[];
  current: Map<string, ProjectAdMetrics[]>;
  previous: Map<string, ProjectAdMetrics[]>;
  linkedProjectIds: Set<string>;
};

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function analyticsHref(projectId: string): string {
  return `/analytics?project=${encodeURIComponent(projectId)}&section=ads`;
}

export function buildAdAlerts({
  projects,
  current,
  previous,
  linkedProjectIds,
}: BuildAdAlertsInput): AdAlert[] {
  const alerts: AdAlert[] = [];

  for (const project of projects) {
    if (!linkedProjectIds.has(project.id)) continue;
    const href = analyticsHref(project.id);
    const currentRows = current.get(project.id) ?? [];
    const previousRows = previous.get(project.id) ?? [];
    const previousByCurrency = new Map(
      previousRows.map((row) => [row.currency ?? "__unknown__", row]),
    );
    for (const currentRow of currentRows) {
      const currencyKey = currentRow.currency ?? "__unknown__";
      const previousRow = previousByCurrency.get(currencyKey);
      const currencyLabel = currentRow.currency ?? "без валюты";
      const currentGoal = currentRow.primaryGoals[0]?.actionType ?? null;
      const previousGoal = previousRow?.primaryGoals[0]?.actionType ?? null;

      if (
        currentRow.costPerResult !== null &&
        previousRow?.costPerResult !== null &&
        previousRow?.costPerResult !== undefined &&
        previousRow.costPerResult > 0 &&
        currentGoal === previousGoal &&
        currentRow.results < previousRow.results
      ) {
        const increase =
          currentRow.costPerResult / previousRow.costPerResult - 1;
        if (
          currentRow.costPerResult >=
          previousRow.costPerResult *
            (1 + AD_ALERT_THRESHOLDS.costIncreaseRatio)
        ) {
          alerts.push({
            id: `${project.id}:cost-increase:${currencyKey}`,
            projectId: project.id,
            projectName: project.name,
            kind: "cost-increase",
            severity: "red",
            title: `CPA вырос на ${percentage(increase)}, заявок стало меньше`,
            detail: `Заявки: ${previousRow.results} → ${currentRow.results}. Сравнение одинаковой цели в ${currencyLabel} за два периода по 7 дней.`,
            href,
          });
        }
      }

      if (
        currentRow.spend >= AD_ALERT_THRESHOLDS.minimumSpendWithoutResults &&
        currentRow.results === 0
      ) {
        const noResultsForTwoPeriods =
          previousRow &&
          previousRow.spend >= AD_ALERT_THRESHOLDS.minimumSpendWithoutResults &&
          previousRow.results === 0;
        alerts.push({
          id: `${project.id}:${noResultsForTwoPeriods ? "no-results" : "spend-without-results"}:${currencyKey}`,
          projectId: project.id,
          projectName: project.name,
          kind: noResultsForTwoPeriods
            ? "no-results"
            : "spend-without-results",
          severity: "red",
          title: noResultsForTwoPeriods
            ? `Нет результатов ${AD_ALERT_THRESHOLDS.noResultsDays} дней`
            : "Расход есть, результатов нет",
          detail: `Проверьте кампании и основную цель кабинета в ${currencyLabel}.`,
          href,
        });
      }
    }
  }

  const severityRank = { red: 0, amber: 1 } as const;
  return alerts.sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      a.projectName.localeCompare(b.projectName, "ru") ||
      a.title.localeCompare(b.title, "ru"),
  );
}
