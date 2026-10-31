import type { CampaignDay } from "@/lib/connected-ads-sync";
import type { YandexCampaignDay } from "@/lib/yandex-direct";
import { type YandexAttributionModel, yandexGoalAction } from "@/lib/yandex-goals";

export function yandexCampaignDays(rows: YandexCampaignDay[], attribution: YandexAttributionModel = "LC"): CampaignDay[] {
  return rows.map((row) => ({ campaignId: row.campaignId, name: row.campaignName, date: row.date, spend: row.cost, impressions: row.impressions, clicks: row.clicks,
    results: null, actionType: "yandex:conversions", spendIncludesVat: true,
    goalResults: Object.entries(row.goals ?? {}).map(([id, count]) => ({ action: yandexGoalAction(id, attribution), count, value: row.goalValues?.[id] ?? null })),
  }));
}

/** Attribution changes conversions, not spend. Never sum traffic or combine model actions. */
export function mergeYandexAttributionDays(base: CampaignDay[], extra: CampaignDay[], today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" })): CampaignDay[] {
  const days = new Map(base.map((row) => [`${row.campaignId}:${row.date}`, row]));
  const extraKeys = new Set(extra.map((row) => `${row.campaignId}:${row.date}`));
  if (days.size !== base.length || extraKeys.size !== extra.length) throw new Error("Повторная строка модели атрибуции.");
  if (base.some((row) => row.date !== today && !extraKeys.has(`${row.campaignId}:${row.date}`)) ||
      extra.some((row) => row.date !== today && !days.has(`${row.campaignId}:${row.date}`)))
    throw new Error("Неполное покрытие дней между моделями атрибуции. Данные не заменены нулями.");
  for (const row of extra) {
    const key = `${row.campaignId}:${row.date}`;
    const previous = days.get(key);
    if (previous && row.date !== today && (previous.spend !== row.spend || previous.clicks !== row.clicks || previous.impressions !== row.impressions))
      throw new Error(`Метрики за ${row.date} изменились между моделями атрибуции. Повторите загрузку.`);
    const goals = [...(previous?.goalResults ?? []), ...(row.goalResults ?? [])];
    if (new Set(goals.map((goal) => goal.action)).size !== goals.length) throw new Error("Повторная цель в модели атрибуции.");
    days.set(key, { ...(previous ?? row), goalResults: goals });
  }
  return [...days.values()];
}
