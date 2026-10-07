import { goalLabel } from "@/lib/ad-goals";
import type { GoalCard } from "@/lib/project-ad-goals";
import { percentChange } from "@/lib/project-ad-dashboard";

export type DashboardMetric = {
  id: string; label: string; group: string; value: number | null; delta: number | null;
  format: "number" | "money" | "percent"; lowerIsBetter?: boolean; neutral?: boolean;
  info: string; note?: string; defaultVisible: boolean;
};

export const goalMetricId = (key: string, kind: "results" | "price") => `goal:${key}:${kind}`;

/** Labels refer to the platform's conversion, not organic follower growth or assumed leads. */
export function goalPriceLabel(card: Pick<GoalCard, "key" | "label">): string {
  const names: Record<string, string> = {
    leads: "Цена лида", messages: "Цена переписки", subscriptions: "Цена подписки",
    purchases: "Цена покупки", cart: "Цена добавления в корзину", registrations: "Цена регистрации",
    applications: "Цена заявки", contacts: "Цена обращения", checkout: "Цена оформления заказа",
    clicks: "Цена клика по ссылке", profile: "Цена перехода в профиль", landing: "Цена просмотра сайта",
    telegram_joins: "Цена подписчика Telegram", engagement: "Цена вовлечения", video: "Цена просмотра видео",
  };
  return !card.key.startsWith("custom:") && card.label === goalLabel(card.key) && names[card.key]
    ? names[card.key] : `Цена: ${card.label}`;
}

export function mandatoryMetricIds(goal: string | null): string[] {
  return goal ? ["spend", goalMetricId(goal, "results"), goalMetricId(goal, "price")] : ["spend", "conversions", "cpa"];
}

/** Saved choices are identifiers only: no spend, conversions, project names or credentials. */
export function parseMetricSelection(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > 100 || !value.every((id) => typeof id === "string" && id.length < 180)) return null;
    return [...new Set(value as string[])];
  } catch { return null; }
}

export function visibleMetricIds(options: Pick<DashboardMetric, "id" | "defaultVisible">[], saved: string[] | null, required: string[]): string[] {
  const chosen = new Set([...(saved ?? options.filter((item) => item.defaultVisible).map((item) => item.id)), ...required]);
  return options.filter((item) => chosen.has(item.id)).map((item) => item.id);
}

export function dashboardStorageKey(userId: string, projectId: string): string {
  return `agency-os:ad-metrics:v1:${userId}:${projectId}`;
}

export function buildDashboardMetrics({ cards, defaultGoals, hasData, currency, previousCurrency, spend, previousSpend, impressions, previousImpressions, clicks, previousClicks }: {
  cards: GoalCard[]; defaultGoals: Set<string>; hasData: boolean;
  currency: string | null; previousCurrency: string | null;
  spend: number; previousSpend: number; impressions: number; previousImpressions: number;
  clicks: number; previousClicks: number;
}): DashboardMetric[] {
  const metrics: DashboardMetric[] = [{
    id: "spend", label: "Расход", group: "Основные", value: hasData && currency ? spend : null,
    delta: hasData && currency && previousCurrency ? percentChange(spend, previousSpend) : null,
    format: "money", neutral: true, defaultVisible: true,
    info: "Расход в выбранной валюте сводки. Исходные суммы доступны в таблице кабинетов.",
  }];
  for (const card of cards) {
    const defaultVisible = defaultGoals.has(card.key);
    const price = currency && !card.extra && hasData ? card.current.cpa : null;
    metrics.push({
      id: goalMetricId(card.key, "results"), label: card.label, group: card.label,
      value: hasData && card.current.complete !== false ? card.current.results : null, delta: hasData && card.current.complete !== false && card.previous.complete !== false ? percentChange(card.current.results, card.previous.results) : null,
      format: "number", defaultVisible,
      info: card.key.startsWith('yandex:') ? "Целевые визиты по конкретной цели Яндекса в выбранных кампаниях. Атрибуция: последний переход (LC). Это не сумма автоцелей и не уникальные лиды." : card.extra ? "Действия по этой цели во всех выбранных кампаниях; не складываются с другими целями." : "Результаты только кампаний, работающих на эту цель. Изменение сравнивает количество, а не цену.",
      note: card.current.complete === false ? "Данные этой цели за период не загружены полностью" : card.extra ? "Дополнительная цель · по всем кампаниям" : card.key.startsWith('yandex:') ? "Атрибуция: последний переход · целевые визиты" : undefined,
    }, {
      id: goalMetricId(card.key, "price"), label: goalPriceLabel(card), group: card.label,
      value: price, delta: previousCurrency ? percentChange(price, card.previous.cpa) : null,
      format: "money", lowerIsBetter: true, defaultVisible: defaultVisible && !card.extra,
      info: card.key.startsWith('yandex:') ? "Расход выбранных кампаний / целевые визиты по этой цели (LC). Для направления учитываются только привязанные к нему кампании." : "Расход кампаний, оптимизированных на эту цель, делённый на их результаты. Снижение цены — улучшение.",
      note: card.current.complete === false ? "Данные этой цели за период не загружены полностью" : card.extra ? "Нет кампаний на эту цель — отдельной цены нет" : !currency ? "Нет общей валюты или курса" : card.current.results === 0 ? "Нет результатов для расчёта цены" : undefined,
    });
  }
  if (!cards.length || !defaultGoals.size) metrics.push(...["conversions", "cpa"].map((id): DashboardMetric => ({
    id, label: id === "cpa" ? "Цена конверсии" : "Конверсии", group: "Основные",
    value: null, delta: null, format: id === "cpa" ? "money" : "number", defaultVisible: true,
    info: "Выберите цель с доступными данными. Разные цели не суммируются.", note: "Нет доступной цели за этот период",
  })));
  const ratio = (amount: number, count: number, factor = 1) => count > 0 ? amount / count * factor : null;
  const traffic = [
    { id: "impressions", label: "Показы", value: impressions, before: previousImpressions, format: "number" as const, info: "Количество показов рекламы; не уникальные люди." },
    { id: "clicks", label: "Клики", value: clicks, before: previousClicks, format: "number" as const, info: "Клики, переданные площадкой; это не количество заявок." },
    { id: "ctr", label: "CTR", value: ratio(clicks, impressions, 100), before: ratio(previousClicks, previousImpressions, 100), format: "percent" as const, info: "Клики / показы × 100%. Рассчитывается по общим числителю и знаменателю." },
    { id: "cpm", label: "CPM", value: currency ? ratio(spend, impressions, 1000) : null, before: previousCurrency ? ratio(previousSpend, previousImpressions, 1000) : null, format: "money" as const, lowerIsBetter: true, info: "Расход / показы × 1000: цена тысячи показов в валюте сводки." },
    { id: "cpc", label: "CPC", value: currency ? ratio(spend, clicks) : null, before: previousCurrency ? ratio(previousSpend, previousClicks) : null, format: "money" as const, lowerIsBetter: true, info: "Расход / клики: цена клика в валюте сводки." },
  ];
  for (const item of traffic) metrics.push({ ...item, group: "Трафик", defaultVisible: false,
    value: hasData ? item.value : null, delta: hasData ? percentChange(item.value, item.before) : null,
  });
  return metrics;
}
