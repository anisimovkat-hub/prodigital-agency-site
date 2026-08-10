import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartNoAxesCombined, Images, Megaphone } from "lucide-react";

import {
  MarketingDashboard,
} from "@/components/marketing-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MarketingPayload, MarketingPost } from "@/lib/marketing-analytics";
import { marketingSection, type MarketingSection } from "@/lib/marketing-sections";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type SearchParams = { from?: string; to?: string; section?: string; view?: string };
type DataObject = Record<string, unknown>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function object(value: unknown): DataObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as DataObject)
    : {};
}
function list(value: unknown): DataObject[] {
  return Array.isArray(value) ? value.map(object) : [];
}

function number(value: unknown): number {
  return Number(value ?? 0) || 0;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function parsePayload(value: unknown): MarketingPayload | null {
  const root = object(value);
  const project = object(root.project);
  if (!string(project.id) || !string(project.name)) return null;
  const organic = object(root.organic);
  const organicTotals = object(organic.totals);
  const account = object(organic.account);
  const postTotals = object(organic.post_totals);
  const paid = object(root.paid);
  const paidTotals = object(paid.totals);
  const period = object(root.period);
  const posts: MarketingPost[] = list(organic.posts).map((post) => ({
    caption: string(post.caption),
    mediaType: string(post.media_type),
    imageUrl: string(post.thumbnail_url) || string(post.media_url),
    permalink: string(post.permalink),
    publishedAt: string(post.published_at) ?? "",
    reach: number(post.reach),
    views: number(post.views),
    likes: number(post.likes),
    comments: number(post.comments),
    saved: number(post.saved),
    shares: number(post.shares),
    engagements: number(post.engagements),
  }));
  const dailyMap = new Map<string, MarketingPayload["daily"][number]>();
  for (const row of list(organic.daily)) {
    const date = string(row.date);
    if (!date) continue;
    dailyMap.set(date, {
      date,
      organicReach: number(row.reach),
      paidReach: 0,
      spend: 0,
      engagements: number(row.engagements),
      conversions: 0,
    });
  }
  for (const row of list(paid.daily)) {
    const date = string(row.date);
    if (!date) continue;
    const existing = dailyMap.get(date) ?? {
      date,
      organicReach: 0,
      paidReach: 0,
      spend: 0,
      engagements: 0,
      conversions: 0,
    };
    existing.paidReach += number(row.reach);
    existing.spend += number(row.spend);
    dailyMap.set(date, existing);
  }
  const organicReach = number(organicTotals.reach);
  const engagements = number(organicTotals.engagements);
  const spend = number(paidTotals.spend);
  const conversions = number(paidTotals.conversions);
  const conversionValue = number(paidTotals.conversion_value);
  const clicks = number(paidTotals.clicks);
  const impressions = number(paidTotals.impressions);
  const currencies = Array.isArray(paid.currencies)
    ? paid.currencies.filter((item): item is string => typeof item === "string")
    : [];
  return {
    project: {
      id: string(project.id),
      name: string(project.title) || string(project.name) || "Отчёт",
      logoUrl: string(project.logo_url),
    },
    period: {
      from: string(period.from) ?? "",
      to: string(period.to) ?? "",
    },
    organic: {
      connected: Boolean(account.username || account.name),
      accountName: string(account.username) || string(account.name),
      followers: number(account.followers_count),
      followerGrowth: number(organicTotals.follower_growth),
      reach: organicReach,
      impressions: number(organicTotals.impressions),
      engagements,
      engagementRate: organicReach > 0 ? engagements / organicReach : null,
      publications: number(postTotals.publications),
      saves: number(postTotals.saves),
      posts,
    },
    paid: {
      connected: spend > 0 || impressions > 0,
      spend,
      impressions,
      reach: number(paidTotals.reach),
      clicks,
      conversions,
      conversionValue,
      ctr: impressions > 0 ? clicks / impressions : null,
      cpa: conversions > 0 && currencies.length === 1 ? spend / conversions : null,
      roas: spend > 0 && currencies.length === 1 ? conversionValue / spend : null,
      currencies,
      campaigns: [],
      adSets: [],
      ads: [],
      audience: { age: [], gender: [], country: [], region: [], placement: [] },
    },
    daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function PublicFilters({
  token,
  from,
  to,
  section,
}: {
  token: string;
  from: string;
  to: string;
  section: MarketingSection;
}) {
  const tabs = [
    { value: "overview" as const, label: "Обзор", icon: ChartNoAxesCombined, style: "border-sky-200 bg-sky-50 text-sky-900" },
    { value: "content" as const, label: "Контент", icon: Images, style: "border-violet-200 bg-violet-50 text-violet-900" },
    { value: "ads" as const, label: "Реклама", icon: Megaphone, style: "border-amber-200 bg-amber-50 text-amber-900" },
  ];
  const base = `/report/${token}`;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 lg:flex-row lg:items-end lg:justify-between">
      <form action={base} method="get" className="grid gap-3 sm:grid-cols-[180px_180px_auto]">
        <input type="hidden" name="section" value={section} />
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">С даты<Input name="from" type="date" defaultValue={from} /></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">По дату<Input name="to" type="date" defaultValue={to} /></label>
        <Button type="submit" variant="outline">Показать</Button>
      </form>
      <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto">
        {tabs.map((tab) => {
          const search = new URLSearchParams({ from, to, section: tab.value });
          return <Link key={tab.value} href={`${base}?${search}`} className={cn("flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all hover:brightness-95", tab.style, section === tab.value && "shadow-sm ring-1 ring-current/25")}><tab.icon className="h-4 w-4" aria-hidden="true" />{tab.label}</Link>;
        })}
      </div>
    </div>
  );
}

export default async function ClientReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();
  const query = await searchParams;
  const from = query.from && ISO_DATE.test(query.from) ? query.from : daysAgo(29);
  const to = query.to && ISO_DATE.test(query.to) ? query.to : daysAgo(0);
  const section = marketingSection(query.section, query.view);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_report_payload", {
    p_token: token,
    p_since: from,
    p_until: to,
  });
  if (error || !data) notFound();
  const payload = parsePayload(data);
  if (!payload) notFound();

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-6 sm:px-6 lg:px-10">
      <MarketingDashboard
        payload={payload}
        section={section}
        publicReport
        controls={<span className="text-sm font-semibold text-neutral-400">ProDigital</span>}
        filters={<PublicFilters token={token} from={from} to={to} section={section} />}
      />
    </main>
  );
}
