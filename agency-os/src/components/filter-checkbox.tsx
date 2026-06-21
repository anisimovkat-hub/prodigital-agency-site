"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Checkbox } from "@/components/ui/checkbox";

export function FilterCheckbox({
  name,
  label,
}: {
  name: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const checked = searchParams.get(name) === "1";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.checked) {
      params.set(name, "1");
    } else {
      params.delete(name);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 self-end pb-2 text-sm text-neutral-700">
      <Checkbox checked={checked} onChange={handleChange} />
      {label}
    </label>
  );
}
