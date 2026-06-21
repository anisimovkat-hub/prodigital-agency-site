"use client";

import { useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { toggleChecklistItem } from "@/app/(dashboard)/tasks/actions";

export function ChecklistItemCheckbox({
  itemId,
  done,
}: {
  itemId: string;
  done: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Checkbox
      defaultChecked={done}
      disabled={isPending}
      onChange={(e) => {
        const checked = e.target.checked;
        startTransition(() => {
          toggleChecklistItem(itemId, checked);
        });
      }}
    />
  );
}
