export type MarketingDailyPoint = {
  date: string;
  organicReach: number;
  paidReach: number;
  spend: number;
  engagements: number;
  conversions: number;
};

export type MarketingPost = {
  caption: string | null;
  mediaType: string | null;
  imageUrl: string | null;
  permalink: string | null;
  publishedAt: string;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  saved: number;
  shares: number;
  engagements: number;
};

export type MarketingPayload = {
  project: {
    id: string | null;
    name: string;
    logoUrl: string | null;
  };
  period: { from: string; to: string };
  organic: {
    connected: boolean;
    accountName: string | null;
    followers: number;
    followerGrowth: number;
    reach: number;
    impressions: number;
    engagements: number;
    engagementRate: number | null;
    publications: number;
    saves: number;
    posts: MarketingPost[];
  };
  paid: {
    connected: boolean;
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    conversions: number;
    conversionValue: number;
    ctr: number | null;
    cpa: number | null;
    roas: number | null;
    currencies: string[];
  };
  daily: MarketingDailyPoint[];
};

export type MarketingInsight = {
  tone: "positive" | "info" | "warning";
  title: string;
  detail: string;
};

function percentChange(previous: number, current: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function signedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("ru-RU", {
    maximumFractionDigits: 1,
  })}%`;
}

export function buildMarketingInsights(payload: MarketingPayload): MarketingInsight[] {
  const midpoint = Math.ceil(payload.daily.length / 2);
  const first = payload.daily.slice(0, midpoint);
  const second = payload.daily.slice(midpoint);
  const sum = (rows: MarketingDailyPoint[], key: keyof MarketingDailyPoint) =>
    rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  const reachChange = percentChange(
    sum(first, "organicReach"),
    sum(second, "organicReach"),
  );
  const cpaFirstSpend = sum(first, "spend");
  const cpaSecondSpend = sum(second, "spend");
  const cpaFirstConversions = sum(first, "conversions");
  const cpaSecondConversions = sum(second, "conversions");
  const cpaChange = percentChange(
    cpaFirstConversions > 0 ? cpaFirstSpend / cpaFirstConversions : 0,
    cpaSecondConversions > 0 ? cpaSecondSpend / cpaSecondConversions : 0,
  );

  const reels = payload.organic.posts.filter((post) =>
    /video|reel/i.test(post.mediaType ?? ""),
  );
  const reelsReach = reels.reduce((sumValue, post) => sumValue + post.reach, 0);
  const postsReach = payload.organic.posts.reduce((sumValue, post) => sumValue + post.reach, 0);
  const reelsShare = postsReach > 0 ? (reelsReach / postsReach) * 100 : null;

  const insights: MarketingInsight[] = [];
  if (payload.organic.connected && reachChange !== null) {
    insights.push({
      tone: reachChange >= 0 ? "positive" : "warning",
      title: `Органический охват: ${signedPercent(reachChange)}`,
      detail:
        reachChange >= 0
          ? "Динамика второй половины периода лучше первой — закрепите удачные темы."
          : "Охват снизился — проверьте регулярность и повторите форматы лучших публикаций.",
    });
  }
  if (reelsShare !== null) {
    insights.push({
      tone: "info",
      title: `Reels дают ${Math.round(reelsShare)}% охвата контента`,
      detail: "Используйте этот формат как основной источник охвата и тестируйте первые 3 секунды.",
    });
  }
  if (payload.paid.connected) {
    const comparableMoney = payload.paid.currencies.length === 1;
    if (comparableMoney && cpaChange !== null && cpaChange > 15) {
      insights.push({
        tone: "warning",
        title: `Стоимость результата выросла на ${Math.round(cpaChange)}%`,
        detail: "Проверьте объявления с расходом без результатов и обновите связки с высоким CPA.",
      });
    } else {
      insights.push({
        tone: payload.paid.conversions > 0 ? "positive" : "warning",
        title:
          payload.paid.conversions > 0
            ? `${Math.round(payload.paid.conversions)} результатов из рекламы`
            : "Расход есть, результатов пока нет",
        detail:
          payload.paid.conversions > 0
            ? "Сравните CPA кампаний и перенесите бюджет в самые эффективные связки."
            : "Проверьте выбранную цель, корректность отслеживания и кампании без конверсий.",
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      tone: "info",
      title: "Данных пока недостаточно для вывода",
      detail: "Подключите Instagram или выберите проект с рекламными данными — рекомендации появятся автоматически.",
    });
  }
  return insights.slice(0, 3);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatMetricPercent(value: number | null): string {
  return value === null
    ? "—"
    : `${(value * 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%`;
}
