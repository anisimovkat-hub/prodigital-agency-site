"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import {
  updateClientStatus,
  type ClientStatusFormState,
} from "@/app/(dashboard)/clients/actions";
import { Select } from "@/components/ui/select";
import { CLIENT_STATUS_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { CLIENT_STATUS_VALUES } from "@/lib/validation";

const STATUS_CLASS: Record<Enums<"client_status">, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  paused: "border-amber-200 bg-amber-50 text-amber-700",
  churned: "border-neutral-200 bg-neutral-100 text-neutral-700",
};

export function ClientStatusSelect({
  clientId,
  clientName,
  value,
}: {
  clientId: string;
  clientName: string;
  value: Enums<"client_status">;
}) {
  const [state, formAction, pending] = useActionState<ClientStatusFormState, FormData>(
    updateClientStatus,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackId = useId();

  useEffect(() => {
    if (state?.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="inline-flex flex-col">
      <input type="hidden" name="id" value={clientId} />
      <Select
        key={value}
        name="status"
        defaultValue={value}
        disabled={pending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        aria-label={`Изменить статус клиента «${clientName}»`}
        aria-describedby={feedbackId}
        aria-invalid={Boolean(state?.error)}
        title="Нажмите, чтобы изменить статус"
        className={cn(
          "h-7 w-auto min-w-0 cursor-pointer rounded-full border px-2 py-0 pr-6 text-sm font-medium shadow-none transition-colors hover:brightness-95 focus-visible:ring-2",
          STATUS_CLASS[value],
        )}
      >
        {CLIENT_STATUS_VALUES.map((status) => (
          <option key={status} value={status}>
            {CLIENT_STATUS_LABEL[status]}
          </option>
        ))}
      </Select>
      <span
        id={feedbackId}
        aria-live="polite"
        className={state?.error ? "mt-1 max-w-48 text-xs leading-tight text-red-600" : "sr-only"}
      >
        {pending
          ? "Сохраняем статус"
          : state?.error
            ? state.error
            : state?.success
              ? "Статус сохранён"
              : ""}
      </span>
    </form>
  );
}
