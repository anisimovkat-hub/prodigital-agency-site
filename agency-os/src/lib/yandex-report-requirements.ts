import { type YandexAttributionModel, type YandexGoal } from "@/lib/yandex-goals";

/** Verified reporting requirements, not owner UI visibility or advertising settings. */
export const YANDEX_REPORT_REQUIREMENTS = [
  {
    accountId: "92d981b0-3e87-4345-8037-7de00077c988", projectId: "e5a66e71-b972-4fbb-b5f4-68c8614916b6", externalId: "e-17459056",
    attribution: "LSCCD", goalIds: ["194376727", "3014496817", "224072509", "3071291494", "661982976", "661983554", "661983342"],
  },
  {
    accountId: "788e134b-006c-446d-b4f3-a1f1bdfbf5ec", projectId: "c5c2bbf1-4ea6-4e49-b469-1416710d7dbd", externalId: "e-20085153",
    attribution: "AUTO", goalIds: ["567110013", "586001346", "586001990", "557993337", "668596275", "668598227"],
  },
] as const satisfies readonly { accountId: string; projectId: string; externalId: string; attribution: YandexAttributionModel; goalIds: readonly string[] }[];

export function yandexReportRequirement(account: { id: string; project_id: string | null; external_id: string }) {
  return YANDEX_REPORT_REQUIREMENTS.find((row) => row.accountId === account.id && row.projectId === account.project_id && row.externalId === account.external_id);
}

export function requiredYandexReportGoals(catalog: YandexGoal[], goalIds: readonly string[]): YandexGoal[] {
  if (goalIds.length > 10) throw new Error("Слишком много обязательных отчётных целей.");
  const byId = new Map(catalog.map((goal) => [goal.id, goal]));
  return goalIds.map((id) => {
    const goal = byId.get(id);
    if (!goal) throw new Error(`Обязательная отчётная цель ${id} отсутствует в каталоге кабинета.`);
    return goal;
  });
}
