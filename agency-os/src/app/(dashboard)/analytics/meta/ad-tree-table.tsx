"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Сериализуемая строка дерева: кампания (level 0) → группа (1) → объявление (2).
export type AdTreeRow = {
  id: string;
  name: string;
  status: string | null;
  level: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  results: number | null;
  goalLabel: string | null;
  cpa: number | null;
  currency: string | null;
  children: AdTreeRow[];
};

function formatNumber(value: number, maximumFractionDigits: number): string {
  const rounded = value.toFixed(maximumFractionDigits);
  const [integer, rawFraction = ""] = rounded.split(".");
  const fraction = rawFraction.replace(/0+$/, "");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fraction ? `${grouped},${fraction}` : grouped;
}

function fmt(value: number): string {
  return formatNumber(value, 0);
}

function fmtMoney(value: number | null): string {
  if (value === null) return "—";
  return formatNumber(value, value < 100 ? 2 : 0);
}

function fmtPercent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(2)}%`;
}

const LEVEL_LABEL = ["Кампания", "Группа", "Объявление"];

export function AdTreeTable({ rows }: { rows: AdTreeRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Плоский список видимых строк с учётом раскрытия.
  const visible: AdTreeRow[] = [];
  const walk = (row: AdTreeRow) => {
    visible.push(row);
    if (expanded.has(row.id)) row.children.forEach(walk);
  };
  rows.forEach(walk);

  return (
    <Table>
      <TableHeader>
          <TableRow>
            <TableHead className="min-w-64">Название</TableHead>
            <TableHead className="text-right">Расход</TableHead>
            <TableHead className="text-right">Показы</TableHead>
            <TableHead className="text-right">Клики</TableHead>
            <TableHead className="text-right">CTR</TableHead>
            <TableHead className="text-right">CPM</TableHead>
            <TableHead className="text-right">CPC</TableHead>
            <TableHead>Результат</TableHead>
            <TableHead className="text-right">CPA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row) => {
            const hasChildren = row.children.length > 0;
            const isOpen = expanded.has(row.id);
            return (
              <TableRow
                key={row.id}
                className={row.level === 0 ? "bg-neutral-50/40" : ""}
              >
                <TableCell>
                  <div
                    className="flex items-center gap-1.5"
                    style={{ paddingLeft: row.level * 20 }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggle(row.id)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-neutral-200"
                        aria-label={isOpen ? "Свернуть" : "Развернуть"}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-neutral-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-neutral-500" />
                        )}
                      </button>
                    ) : (
                      <span className="h-5 w-5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div
                        className={`truncate ${
                          row.level === 0
                            ? "font-medium text-neutral-900"
                            : "text-neutral-700"
                        }`}
                        title={row.name}
                      >
                        {row.name}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {LEVEL_LABEL[row.level]}
                        {row.status && row.status !== "ACTIVE"
                          ? ` · ${row.status}`
                          : ""}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMoney(row.spend)}
                  {row.currency ? (
                    <span className="ml-1 text-xs text-neutral-400">
                      {row.currency}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums text-neutral-600">
                  {fmt(row.impressions)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-neutral-600">
                  {fmt(row.clicks)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-neutral-600">
                  {fmtPercent(row.ctr)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-neutral-600">
                  {fmtMoney(row.cpm)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-neutral-600">
                  {fmtMoney(row.cpc)}
                </TableCell>
                <TableCell>
                  {row.results !== null ? (
                    <div>
                      <span className="font-medium text-neutral-900">
                        {fmt(row.results)}
                      </span>
                      {row.goalLabel ? (
                        <span className="ml-1 text-xs text-neutral-500">
                          {row.goalLabel}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMoney(row.cpa)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
  );
}
