"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

  // Меняем несколько параметров разом; сброшенные значения удаляем из URL.
  function apply(changes: Partial<AdsFilterValues>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  // Каскад: при смене проекта сбрасываем кабинет и кампанию; при смене
  // кабинета — кампанию (иначе выбранное может не соответствовать фильтру).
  function onProjectChange(value: string) {
    apply({ project: value, account: "", campaign: "" });
  }
  function onAccountChange(value: string) {
    apply({ account: value, campaign: "" });
  }

  const visibleAccounts = accounts.filter(
    (a) => !current.project || a.project_id === current.project,
  );
  const visibleCampaigns = campaigns.filter(
    (c) =>
      (!current.project || c.project_id === current.project) &&
      (!current.account || c.account_id === current.account),
  );

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-4 lg:grid-cols-7">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-500">С даты</span>
        <Input
          type="date"
          defaultValue={current.from}
          max={current.to}
          onChange={(e) => apply({ from: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-500">По дату</span>
        <Input
          type="date"
          defaultValue={current.to}
          min={current.from}
          onChange={(e) => apply({ to: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-500">Гранулярность</span>
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
  );
}
