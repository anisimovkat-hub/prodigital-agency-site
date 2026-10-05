"use client";

import { Fragment, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronsUpDown, CircleHelp } from "lucide-react";
import { SiGoogleads, SiMeta, SiTelegram, SiVk } from "react-icons/si";
import { FaYandex } from "react-icons/fa";

import { formatAdMoney, formatAdNumber, formatAdPercent } from "@/lib/project-ad-dashboard";

type Result = {
  spend: number;
  conversions: number | null;
  cpa: number | null;
  delta: number | null;
  trend: { bucket: string; conversions: number }[];
};
type CampaignResult = Result & { id: string; name: string };
export type AdAccountResult = Result & { id: string; name: string; platform: string; currency: string | null; campaigns: CampaignResult[] };

type SortKey = "spend" | "conversions" | "cpa" | "delta";
const PLATFORMS: Record<string, string> = { meta: "Meta Ads", yandex_direct: "Яндекс Директ", google_ads: "Google Ads", vk: "VK Реклама", telegram_ads: "Telegram Ads" };
const VISIBLE_CAMPAIGNS = 5;

function PlatformMark({ platform }: { platform: string }) {
  const box = "flex size-8 shrink-0 items-center justify-center rounded-full";
  if (platform === "meta") return <span className={`${box} bg-blue-50`}><SiMeta className="size-[18px] text-[#0866ff]" aria-hidden="true" /></span>;
  if (platform === "yandex_direct") return <span className={`${box} bg-red-50`}><FaYandex className="size-4 text-[#fc3f1d]" aria-hidden="true" /></span>;
  if (platform === "google_ads") return <span className={`${box} bg-amber-50`}><SiGoogleads className="size-4 text-[#4285f4]" aria-hidden="true" /></span>;
  if (platform === "vk") return <span className={`${box} bg-sky-50`}><SiVk className="size-[18px] text-[#0077ff]" aria-hidden="true" /></span>;
  if (platform === "telegram_ads") return <span className={`${box} bg-sky-50`}><SiTelegram className="size-4 text-[#26a5e4]" aria-hidden="true" /></span>;
  return <span className={`${box} bg-neutral-100`}><CircleHelp className="size-4 text-neutral-400" aria-hidden="true" /></span>;
}

function PriceDelta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-neutral-300" title="Нет сопоставимого прошлого периода">—</span>;
  if (Math.abs(value) < 0.005) return <span className="text-neutral-500">0%</span>;
  const better = value < 0;
  const Icon = better ? ArrowDown : ArrowUp;
  return <span className={`inline-flex items-center justify-end gap-0.5 font-medium ${better ? "text-emerald-600" : "text-rose-600"}`}>
    <Icon className="size-3.5" aria-hidden="true" />{formatAdPercent(value)}
  </span>;
}

function Sparkline({ points }: { points: Result["trend"] }) {
  if (points.length < 2 || !points.some((point) => point.conversions > 0)) return <span className="text-neutral-300">—</span>;
  const maximum = Math.max(1, ...points.map((point) => point.conversions));
  const coordinates = points.map((point, index) => [index / (points.length - 1) * 100, 26 - point.conversions / maximum * 20] as const);
  const line = coordinates.map(([x, y], index) => `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-7 w-28" role="img" aria-label="Динамика результатов за период">
    <path d={`${line} L 100 30 L 0 30 Z`} fill="#3b82f6" fillOpacity="0.08" />
    <path d={line} fill="none" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

function Cells({ result, currency, strong }: { result: Result; currency: string | null; strong?: boolean }) {
  const tone = strong ? "text-neutral-950" : "text-neutral-600";
  return <>
    <td className={`px-3 py-3 text-right tabular-nums ${tone}`}>{currency ? formatAdMoney(result.spend, currency) : "—"}</td>
    <td className={`px-3 py-3 text-right tabular-nums ${tone}`}>{result.conversions === null ? "—" : formatAdNumber(result.conversions)}</td>
    <td className={`px-3 py-3 text-right tabular-nums ${tone}`}>{result.cpa === null ? "—" : formatAdMoney(result.cpa, currency)}</td>
    <td className="px-3 py-3 text-right tabular-nums"><PriceDelta value={result.delta} /></td>
    <td className="py-1.5 pr-5 pl-3"><div className="flex justify-end"><Sparkline points={result.trend} /></div></td>
  </>;
}

function sortValue(result: Result, key: SortKey): number | null {
  return key === "spend" ? result.spend : key === "conversions" ? result.conversions : key === "cpa" ? result.cpa : result.delta;
}

export function AdResultsTable({ accounts }: { accounts: AdAccountResult[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(accounts[0] ? [accounts[0].id] : []));
  const [showAll, setShowAll] = useState<Set<string>>(() => new Set());
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "spend", descending: true });

  const toggleIn = (setter: typeof setExpanded, id: string) => setter((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // Rows without a value stay at the bottom in both directions.
  const order = <T extends Result>(rows: T[]) => [...rows].sort((a, b) => {
    const left = sortValue(a, sort.key), right = sortValue(b, sort.key);
    if (left === null || right === null) return left === right ? b.spend - a.spend : left === null ? 1 : -1;
    return (sort.descending ? right - left : left - right) || b.spend - a.spend;
  });
  const header = (key: SortKey, label: string) => {
    const active = sort.key === key;
    const Icon = !active ? ChevronsUpDown : sort.descending ? ArrowDown : ArrowUp;
    return <th className="px-3 py-3 text-right font-normal" aria-sort={active ? (sort.descending ? "descending" : "ascending") : "none"}>
      <button type="button" className={`inline-flex items-center gap-1 hover:text-neutral-700 ${active ? "text-neutral-700" : ""}`} onClick={() => setSort({ key, descending: active ? !sort.descending : key !== "cpa" })}>
        {label}<Icon className="size-3" aria-hidden="true" />
      </button>
    </th>;
  };

  return <div className="overflow-x-auto">
    <table className="w-full min-w-[820px] text-left text-[13px]">
      <thead><tr className="border-b border-neutral-100 text-xs text-neutral-400">
        <th className="w-[36%] px-5 py-3 font-normal">Источник / Кампания</th>
        {header("spend", "Расход")}
        {header("conversions", "Результаты")}
        {header("cpa", "Цена результата")}
        {header("delta", "Изм. цены")}
        <th className="py-3 pr-5 pl-3 text-right font-normal">Динамика</th>
      </tr></thead>
      <tbody>{order(accounts).map((account) => {
        const open = expanded.has(account.id);
        const campaigns = order(account.campaigns);
        const visible = showAll.has(account.id) ? campaigns : campaigns.slice(0, VISIBLE_CAMPAIGNS);
        return <Fragment key={account.id}>
          <tr className="border-b border-neutral-100 hover:bg-neutral-50/70">
            <td className="px-5 py-2.5">
              <button type="button" className="flex w-full min-w-0 items-center gap-2.5 text-left" onClick={() => toggleIn(setExpanded, account.id)} aria-expanded={open}>
                {open ? <ChevronDown className="size-4 shrink-0 text-neutral-400" /> : <ChevronRight className="size-4 shrink-0 text-neutral-400" />}
                <PlatformMark platform={account.platform} />
                <span className="min-w-0">
                  <span className="block font-semibold text-neutral-950">{PLATFORMS[account.platform] ?? account.platform}</span>
                  <span className="block truncate text-xs text-neutral-400" title={account.name}>{account.name} · {account.campaigns.length} камп.</span>
                </span>
              </button>
            </td>
            <Cells result={account} currency={account.currency} strong />
          </tr>
          {open && visible.map((campaign) => <tr key={campaign.id} className="border-b border-neutral-100 bg-neutral-50/40 hover:bg-neutral-50">
            <td className="max-w-0 py-2.5 pr-3 pl-[70px]">
              <span className="flex min-w-0 items-center gap-2"><span className="size-1 shrink-0 rounded-full bg-neutral-300" /><span className="truncate text-neutral-700" title={campaign.name}>{campaign.name}</span></span>
            </td>
            <Cells result={campaign} currency={account.currency} />
          </tr>)}
          {open && campaigns.length > VISIBLE_CAMPAIGNS && <tr className="border-b border-neutral-100 bg-neutral-50/40">
            <td colSpan={6} className="py-2 pl-[70px]">
              <button type="button" className="text-xs font-medium text-blue-600 hover:underline" onClick={() => toggleIn(setShowAll, account.id)}>
                {showAll.has(account.id) ? "Свернуть" : `Показать все кампании · ещё ${campaigns.length - VISIBLE_CAMPAIGNS}`}
              </button>
            </td>
          </tr>}
        </Fragment>;
      })}</tbody>
    </table>
  </div>;
}
