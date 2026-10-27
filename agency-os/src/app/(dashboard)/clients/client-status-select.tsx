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
  active: "border-emerald-200 bg-emerald-100 text-emerald-800",
  paused: "border-amber-200 bg-amber-100 text-amber-800",
  churned: "border-neutral-300 bg-neutral-100 text-neutral-700",
};

const STATUS_TEXT: Record<Enums<"client_status">, string> = {
  active: "text-emerald-800",
  paused: "text-amber-800",
  churned: "text-neutral-700",
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
  const [state, formAction, pending] = useActionState<
    ClientStatusFormState,
    FormData
  >(updateClientStatus, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackId = useId();

  useEffect(() => {
    if (state?.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="inline-flex flex-col">
      <input type="hidden" name="id" value={clientId} />
      <span
        className={cn("relative inline-flex items-center", STATUS_TEXT[value])}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-1.5 -translate-y-1/2 rounded-full bg-current"
        />
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
            "h-7 w-auto min-w-0 cursor-pointer rounded-full border py-0 pr-6 pl-5 text-sm font-semibold shadow-none transition-colors hover:brightness-95 focus-visible:ring-2",
            STATUS_CLASS[value],
          )}
        >
          {CLIENT_STATUS_VALUES.map((status) => (
            <option key={status} value={status}>
              {CLIENT_STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
      </span>
      <span
        id={feedbackId}
        aria-live="polite"
        className={
          state?.error
            ? "mt-1 max-w-48 text-xs leading-tight text-red-600"
            : "sr-only"
        }
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
