"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select } from "@/components/ui/select";

export function FilterSelect({
  name,
  label,
  placeholder = "Все",
  options,
}: {
  name: string;
  label: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set(name, e.target.value);
    } else {
      params.delete(name);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <Select
        defaultValue={searchParams.get(name) ?? ""}
        onChange={handleChange}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
