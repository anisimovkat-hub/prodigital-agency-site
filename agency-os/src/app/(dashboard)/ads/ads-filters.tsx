"use client";

import { useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { GRANULARITIES } from "@/lib/ad-analytics";

type Option = { id: string; name: string };
type AccountOption = Option & { project_id: string | null };
type CampaignOption = Option & {
  project_id: string | null;
  account_id: string;
};

export type AdsFilterValues = {
  from: string;
  to: string;
  gran: string;
  project: string;
  account: string;
  campaign: string;
  goal: string;
};

export function AdsFilters({
  projects,
  accounts,
  campaigns,
  goals,
  current,
}: {
  projects: Option[];
  accounts: AccountOption[];
  campaigns: CampaignOption[];
  goals: { value: string; label: string }[];
  current: AdsFilterValues;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // useTransition делает навигацию по фильтрам неблокирующей: инпуты остаются
  // отзывчивыми, пока сервер пересчитывает данные (isPending — индикатор).
  const [isPending, startTransition] = useTransition();
  const dateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Меняем несколько параметров разом; сброшенные значения удаляем из URL.
  function apply(changes: Partial<AdsFilterValues>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  // Даты дебаунсим: пока владелец правит число/месяц/год, не дёргаем сервер.
  function applyDateDebounced(field: "from" | "to", value: string) {
    if (dateTimer.current) clearTimeout(dateTimer.current);
    dateTimer.current = setTimeout(() => apply({ [field]: value }), 450);
  }

  // Каскад: при смене проекта сбрасываем кабинет, кампанию И цель; при смене
  // кабинета — кампанию и цель. Иначе от прошлого проекта осталась бы
  // несовместимая цель/кампания.
  function onProjectChange(value: string) {
    apply({ project: value, account: "", campaign: "", goal: "" });
  }
  function onAccountChange(value: string) {
    apply({ account: value, campaign: "", goal: "" });
  }

  function resetFilters() {
    if (dateTimer.current) clearTimeout(dateTimer.current);
    startTransition(() => router.push(pathname));
  }

  const hasActiveFilters =
    !!current.project ||
    !!current.account ||
    !!current.campaign ||
    !!current.goal ||
    !!searchParams.get("from") ||
    !!searchParams.get("to") ||
    !!searchParams.get("gran");

  const visibleAccounts = accounts.filter(
    (a) => !current.project || a.project_id === current.project,
  );
  const visibleCampaigns = campaigns.filter(
    (c) =>
      (!current.project || c.project_id === current.project) &&
      (!current.account || c.account_id === current.account),
  );

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      aria-busy={isPending}
    >
      <div
        className={`grid grid-cols-2 gap-3 transition-opacity md:grid-cols-4 lg:grid-cols-7 ${
          isPending ? "opacity-60" : ""
        }`}
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">С даты</span>
          <Input
            type="date"
            defaultValue={current.from}
            max={current.to}
            onChange={(e) => applyDateDebounced("from", e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">По дату</span>
          <Input
            type="date"
            defaultValue={current.to}
            min={current.from}
            onChange={(e) => applyDateDebounced("to", e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">
            Гранулярность
          </span>
          <Select
            defaultValue={current.gran}
            onChange={(e) => apply({ gran: e.target.value })}
          >
            {GRANULARITIES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">Проект</span>
          <Select
            value={current.project}
            onChange={(e) => onProjectChange(e.target.value)}
          >
            <option value="">Все проекты</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">Кабинет</span>
          <Select
            value={current.account}
            onChange={(e) => onAccountChange(e.target.value)}
          >
            <option value="">Все кабинеты</option>
            {visibleAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">Кампания</span>
          <Select
            value={current.campaign}
            onChange={(e) => apply({ campaign: e.target.value })}
          >
            <option value="">Все кампании</option>
            {visibleCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">Цель</span>
          <Select
            value={current.goal}
            onChange={(e) => apply({ goal: e.target.value })}
          >
            <option value="">Не выбрана</option>
            {goals.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetFilters}
          disabled={!hasActiveFilters}
        >
          Сбросить фильтры
        </Button>
        {isPending && (
          <span className="text-xs text-neutral-400">Обновляю…</span>
        )}
      </div>
    </div>
  );
}
