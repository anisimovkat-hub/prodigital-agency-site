import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MarketingDashboard } from "@/components/marketing-dashboard";
import { MarketingContentReport } from "@/components/marketing-content-report";
import { AnalyticsShell } from "@/app/(dashboard)/analytics/analytics-shell";
import { AnalyticsTabs } from "@/app/(dashboard)/analytics/analytics-controls";
import { ReportCurrencySwitch } from "@/app/(dashboard)/analytics/meta/ads-filters";
import { DashboardMetricGrid } from "@/app/(dashboard)/analytics/meta/dashboard-metric-grid";
import { contentReportData } from "@/lib/marketing-content";
import type { MarketingPayload } from "@/lib/marketing-analytics";

let query = "project=p1&from=2026-09-01&to=2026-09-03&section=ads";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query), usePathname: () => "/analytics", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/(dashboard)/analytics/actions", () => ({ assignSocialAccount: vi.fn(), ensureClientReport: vi.fn(), syncInstagramAnalytics: vi.fn(), syncMetaAudienceAnalytics: vi.fn() }));

function fixture(): MarketingPayload {
  return {
    project: { id: "p1", name: "Team Trip", logoUrl: null },
    period: { from: "2026-09-01", to: "2026-09-03" },
    organic: { connected: true, metricDates: ["2026-09-01", "2026-09-03"], accountName: "teamtrip", followers: 1000, followerGrowth: 2, reach: 30, impressions: 40, engagements: 3, engagementRate: 0.1, publications: 0, saves: 0, posts: [] },
    paid: { connected: true, spend: 100, impressions: 1000, reach: 800, clicks: 30, conversions: 4, conversionValue: 0, ctr: 0.03, cpa: 25, roas: null, currencies: ["USD"], campaigns: [], adSets: [], ads: [], audience: { age: [], gender: [], country: [], region: [], placement: [] } },
    daily: [
      { date: "2026-09-01", organicReach: 10, paidReach: 400, spend: 50, engagements: 1, conversions: 2 },
      { date: "2026-09-02", organicReach: 0, paidReach: 400, spend: 50, engagements: 0, conversions: 2 },
      { date: "2026-09-03", organicReach: 20, paidReach: 0, spend: 0, engagements: 2, conversions: 0 },
    ],
  };
}

describe("content data coverage", () => {
  it("does not invent zero organic metrics from advertising-only days", () => {
    const data = contentReportData(fixture());
    expect(data.days[1]).toEqual({ date: "2026-09-02", reach: null, engagements: null });
    expect(data.reportedDays).toBe(2);
    expect(data.complete).toBe(false);
  });
  it("preserves real reported zeroes", () => {
    const value = fixture();
    value.organic.metricDates!.push("2026-09-02");
    expect(contentReportData(value).days[1].reach).toBe(0);
    expect(contentReportData(value).complete).toBe(true);
  });
  it("shows absence of Instagram metrics independently of ad spend", () => {
    const value = fixture();
    value.organic.metricDates = [];
    expect(contentReportData(value).hasMetrics).toBe(false);
    const html = renderToStaticMarkup(<MarketingContentReport payload={value} />);
    expect(html).toContain("Это не означает нулевой охват");
    expect(html).toContain("Нет загруженных данных за этот период");
  });
  it("does not count organic rows outside the period", () => {
    const value = fixture();
    value.period = { from: "2026-09-02", to: "2026-09-02" };
    expect(contentReportData(value).reportedDays).toBe(0);
  });
  it("explains a disconnected account rather than claiming a failed report", () => {
    const value = fixture();
    value.organic.connected = false;
    value.organic.metricDates = [];
    expect(renderToStaticMarkup(<MarketingContentReport payload={value} />)).toContain("Instagram-аккаунт не подключён к этому проекту");
  });
});

describe("unified report", () => {
  it("renders three baseline cards and the accessible metric customization button", () => {
    const options = [
      { id: "spend", label: "Расход", group: "Основные", defaultVisible: true, content: <article>Расход</article> },
      { id: "conversions", label: "Лиды", group: "Основные", defaultVisible: true, content: <article>Лиды</article> },
      { id: "cpa", label: "Цена лида", group: "Основные", defaultVisible: true, content: <article>Цена лида</article> },
      { id: "cpm", label: "CPM", group: "Трафик", defaultVisible: false, content: <article>CPM</article> },
    ];
    const html = renderToStaticMarkup(<DashboardMetricGrid userId="owner" projectId="p1" options={options} required={["spend", "conversions", "cpa"]} />);
    expect(html).toContain("Добавить показатель");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('data-metric-id="cpa"');
    expect(html).not.toContain('data-metric-id="cpm"');
    expect(html.match(/<article>/g)).toHaveLength(3);
  });
  it("offers original account currency, USD and RUB in one compact selector", () => {
    const html = renderToStaticMarkup(<ReportCurrencySwitch currency="native" nativeCurrency="GBP" />);
    expect(html).toContain('aria-label="Валюта сводки"');
    expect(html).toContain('value="native" selected=""');
    expect(html).toContain("Валюта кабинета · GBP");
    expect(html).toContain("Доллары · USD");
    expect(html).toContain("Рубли · RUB");
  });
  it("renders SVG tooltip titles as one text node for safe hydration", () => {
    const html = renderToString(<MarketingContentReport payload={fixture()} />);
    expect(html).toContain("<title>01.09: 10</title>");
    expect(html).not.toMatch(/<title>[^<]*<!--/);
  });
  it.each(["overview", "content", "ads"] as const)("uses the same header and compact tabs in %s", (section) => {
    const html = renderToStaticMarkup(<MarketingDashboard payload={fixture()} section={section} adsPanel={<div>new-ad-report</div>} filters={<AnalyticsTabs section={section} />} />);
    expect(html).toContain("Аналитика / ");
    expect(html).toContain("Team Trip");
    expect(html).toContain("bg-neutral-100 p-1");
    expect(html).not.toContain("Маркетинговая аналитика");
    expect(html).not.toContain("Главные показатели");
    expect(html.includes("new-ad-report")).toBe(section !== "content");
  });
  it("places the modern ad report in Overview with a compact organic summary", () => {
    const html = renderToStaticMarkup(<MarketingDashboard payload={fixture()} section="overview" adsPanel={<div>new-ad-report</div>} />);
    expect(html).toContain("Контент · кратко");
    expect(html).not.toContain("Вклад каналов в охват");
    expect(html).not.toContain("Стоимость результата");
  });
  it("responds to URL section changes rather than stale initial local state", () => {
    const render = () => renderToStaticMarkup(<AnalyticsShell payload={fixture()} initialSection="ads" params={{ ...fixture().period, project: "p1", social: "", section: "ads" }} projects={[{ id: "p1", name: "Team Trip" }]} socialAccounts={[]} adsPanel={<div>new-ad-report</div>} adsFilters={<div>ad-filters</div>} />);
    query = "project=p1&section=content";
    expect(render()).toContain("Отчёт по контенту");
    expect(render()).not.toContain("new-ad-report");
    query = "project=p1&section=overview";
    expect(render()).toContain("new-ad-report");
    expect(render()).toContain("ad-filters");
    query = "project=p1&section=ads";
    expect(render()).not.toContain("Сводка контента");
  });
  it("preserves existing result metrics in the scoped public report", () => {
    const html = renderToStaticMarkup(<MarketingDashboard payload={fixture()} section="ads" publicReport />);
    expect(html).toContain("Основные результаты");
    expect(html).toContain("Стоимость результата");
    expect(html).toContain("CTR");
    expect(html).toContain("4</p>");
  });
});
