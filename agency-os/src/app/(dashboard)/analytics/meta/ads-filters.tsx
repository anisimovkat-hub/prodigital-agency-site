"use client";

import { useRef, useTransition, type ReactNode } from "react";
import { ChevronDown, Layers, SlidersHorizontal, Target } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { GRANULARITIES } from "@/lib/ad-analytics";
import { AnalyticsPeriodPicker } from "@/app/(dashboard)/analytics/analytics-period-picker";

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

/** A native select dressed as the report's filter pill; the browser keeps keyboard access. */
function FilterSelect({ icon, prefix, label, value, onChange, children }: {
  icon?: ReactNode; prefix?: string; label: string; value: string; onChange: (value: string) => void; children: ReactNode;
}) {
  return <label className="relative flex h-12 min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm text-neutral-900 shadow-sm transition focus-within:ring-2 focus-within:ring-neutral-500 hover:border-neutral-400">
    {icon && <span className="shrink-0 text-neutral-500">{icon}</span>}
    {prefix && <span className="shrink-0 text-neutral-500">{prefix}</span>}
    <span className="min-w-0 flex-1 truncate font-medium" title={label}>{label}</span>
    <ChevronDown className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
    <select className="absolute inset-0 cursor-pointer opacity-0" value={value} onChange={(event) => onChange(event.target.value)} aria-label={prefix ? `${prefix} ${label}` : label}>{children}</select>
  </label>;
}

export function AdsFilters({
  projects,
  accounts,
  campaigns,
  goals,
  current,
  embedded = false,
  report = false,
}: {
  projects: Option[];
  accounts: AccountOption[];
  campaigns: CampaignOption[];
  goals: { value: string; label: string }[];
  current: AdsFilterValues;
  embedded?: boolean;
  report?: boolean;
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
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["gran", "account", "campaign", "goal"]) params.delete(key);
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  }

  const hasActiveFilters =
    !!current.account ||
    !!current.campaign ||
    !!searchParams.get("goal") ||
    !!searchParams.get("gran");

  const visibleAccounts = accounts.filter(
    (a) => !current.project || a.project_id === current.project,
  );
  const visibleCampaigns = campaigns.filter(
    (c) =>
      (!current.project || c.project_id === current.project) &&
      (!current.account || c.account_id === current.account),
  );

  if (report) {
    const goalLabel = goals.find((goal) => goal.value === current.goal)?.label ?? "не выбрана";
    const accountLabel = visibleAccounts.find((account) => account.id === current.account)?.name ?? "Все источники";
    const campaignLabel = visibleCampaigns.find((campaign) => campaign.id === current.campaign)?.name ?? "Все кампании";
    return <div className={`space-y-2 transition-opacity ${isPending ? "opacity-60" : ""}`} aria-busy={isPending}>
      <div className="grid gap-3 md:grid-cols-3">
        <FilterSelect icon={<Target className="size-4" />} prefix="Цель:" label={goalLabel} value={current.goal} onChange={(value) => apply({ goal: value })}>
          {!current.goal && <option value="">Выберите цель</option>}
          {goals.map((goal) => <option key={goal.value} value={goal.value}>{goal.label}</option>)}
        </FilterSelect>
        <AnalyticsPeriodPicker compact key={`${current.from}-${current.to}`} period={{ from: current.from, to: current.to }} onApply={(period) => apply(period)} />
        <FilterSelect icon={<Layers className="size-4" />} label={accountLabel} value={current.account} onChange={onAccountChange}>
          <option value="">Все источники</option>
          {visibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </FilterSelect>
      </div>
      <details className="group text-xs text-neutral-500" open={!!current.campaign || current.gran !== "day" ? true : undefined}>
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 select-none hover:text-neutral-800"><SlidersHorizontal className="size-3.5" />Кампания и шаг графика{isPending ? " · обновляю…" : ""}</summary>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <FilterSelect label={campaignLabel} value={current.campaign} onChange={(value) => apply({ campaign: value })}>
            <option value="">Все кампании</option>
            {visibleCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </FilterSelect>
          <FilterSelect prefix="Шаг:" label={GRANULARITIES.find((item) => item.value === current.gran)?.label ?? "По дням"} value={current.gran} onChange={(value) => apply({ gran: value })}>
            {GRANULARITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </FilterSelect>
          <div className="flex items-center"><Button type="button" variant="ghost" size="sm" onClick={resetFilters} disabled={!hasActiveFilters}>Сбросить фильтры</Button></div>
        </div>
      </details>
    </div>;
  }

  if (embedded) return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3" aria-busy={isPending}>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1"><span className="text-xs font-medium text-neutral-500">Целевая конверсия</span>
          <Select value={current.goal} onChange={(e) => apply({ goal: e.target.value })}>
            <option value="">Выберите цель</option>
            {goals.map((goal) => <option key={goal.value} value={goal.value}>{goal.label}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1"><span className="text-xs font-medium text-neutral-500">Рекламный кабинет</span>
          <Select value={current.account} onChange={(e) => onAccountChange(e.target.value)}>
            <option value="">Все подключённые кабинеты</option>
            {visibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </Select>
        </label>
      </div>
      <details className="mt-2 text-xs text-neutral-500">
        <summary className="cursor-pointer select-none">Дополнительные фильтры</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1"><span>По времени</span>
            <Select value={current.gran} onChange={(e) => apply({ gran: e.target.value })}>
              {GRANULARITIES.map((granularity) => <option key={granularity.value} value={granularity.value}>{granularity.label}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1"><span>Кампания</span>
            <Select value={current.campaign} onChange={(e) => apply({ campaign: e.target.value })}>
              <option value="">Все кампании</option>
              {visibleCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </Select>
          </label>
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={resetFilters} disabled={!hasActiveFilters}>Сбросить фильтры</Button>
      </details>
      {isPending && <span className="mt-2 block text-xs text-neutral-400">Обновляю…</span>}
    </div>
  );

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      aria-busy={isPending}
    >
      <div
        className={`grid grid-cols-2 gap-3 transition-opacity md:grid-cols-4 ${embedded ? "lg:grid-cols-4" : "lg:grid-cols-7"} ${
          isPending ? "opacity-60" : ""
        }`}
      >
        {!embedded && <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">С даты</span>
          <Input
            type="date"
            defaultValue={current.from}
            max={current.to}
            onChange={(e) => applyDateDebounced("from", e.target.value)}
          />
        </label>}

        {!embedded && <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-500">По дату</span>
          <Input
            type="date"
            defaultValue={current.to}
            min={current.from}
            onChange={(e) => applyDateDebounced("to", e.target.value)}
          />
        </label>}

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

        {!embedded && <label className="flex flex-col gap-1">
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
        </label>}

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
