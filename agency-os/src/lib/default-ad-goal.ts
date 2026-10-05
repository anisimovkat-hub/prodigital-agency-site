import type { AdConversionDay } from "@/lib/project-ad-dashboard";

type GoalOption = { value: string; label: string };

/** Pick a useful, source-backed starting view without adding unlike actions together. */
export function selectDefaultAdGoal(
  explicitGoal: string,
  goals: GoalOption[],
  conversions: AdConversionDay[],
  campaignIds: ReadonlySet<string>,
): string | null {
  if (explicitGoal && goals.some((goal) => goal.value === explicitGoal)) return explicitGoal;
  const counts = new Map<string, number>();
  for (const row of conversions) {
    if (!campaignIds.has(row.campaign_id)) continue;
    counts.set(row.action_type, (counts.get(row.action_type) ?? 0) + Number(row.count));
  }
  const positive = goals.filter((goal) => (counts.get(goal.value) ?? 0) > 0);
  if (positive.length === 0) return goals.length === 1 ? goals[0].value : null;

  // A named thank-you/lead goal is more informative than aggregate Meta actions,
  // which can count the same event via several action types.
  const rank = (goal: GoalOption) => {
    const label = goal.label.toLocaleLowerCase("ru-RU");
    if (/спасибо|thank.?you/.test(label)) return 0;
    if (/заявк|лид.?форм/.test(label)) return 1;
    if (/лид|lead/.test(label)) return 2;
    if (/переписк|сообщен|messag/.test(label)) return 3;
    return 4;
  };
  positive.sort((a, b) => rank(a) - rank(b) || (counts.get(b.value) ?? 0) - (counts.get(a.value) ?? 0) || a.label.localeCompare(b.label, "ru"));
  return positive[0].value;
}
