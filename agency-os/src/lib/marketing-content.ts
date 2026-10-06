import type { MarketingPayload } from "@/lib/marketing-analytics";

export type ContentDay = { date: string; reach: number | null; engagements: number | null };

export function contentReportData(payload: MarketingPayload) {
  // Older public report payloads do not include coverage metadata.
  const dates = new Set(payload.organic.metricDates ?? payload.daily
    .filter((day) => day.organicReach > 0 || day.engagements > 0).map((day) => day.date));
  const daily = new Map(payload.daily.map((day) => [day.date, day]));
  const days: ContentDay[] = [];
  const end = new Date(`${payload.period.to}T00:00:00Z`);
  for (const date = new Date(`${payload.period.from}T00:00:00Z`); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const key = date.toISOString().slice(0, 10);
    const day = daily.get(key);
    days.push({ date: key, reach: dates.has(key) ? day?.organicReach ?? 0 : null, engagements: dates.has(key) ? day?.engagements ?? 0 : null });
  }
  const reportedDays = days.filter((day) => day.reach !== null).length;
  return {
    days,
    reportedDays,
    hasMetrics: reportedDays > 0,
    complete: reportedDays === days.length && days.length > 0,
    posts: [...payload.organic.posts].sort((a, b) => b.reach - a.reach),
  };
}
