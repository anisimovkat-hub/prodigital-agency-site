"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  updateProjectQuickField,
  type QuickProjectFieldFormState,
} from "@/app/(dashboard)/projects/actions";
import { Select } from "@/components/ui/select";
import { PROJECT_HEALTH_LABEL, PROJECT_STAGE_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { PROJECT_HEALTH_VALUES, PROJECT_STAGE_VALUES } from "@/lib/validation";

type ProjectQuickSelectProps =
  | {
      projectId: string;
      projectName: string;
      field: "health";
      value: Enums<"project_health">;
    }
  | {
      projectId: string;
      projectName: string;
      field: "stage";
      value: Enums<"project_stage">;
    };

const HEALTH_CLASS: Record<Enums<"project_health">, string> = {
  green: "border-emerald-200 bg-emerald-100 text-emerald-800",
  yellow: "border-amber-200 bg-amber-100 text-amber-800",
  red: "border-red-200 bg-red-100 text-red-800",
};

const STAGE_CLASS: Record<Enums<"project_stage">, string> = {
  launching: "border-blue-200 bg-blue-100 text-blue-800",
  active: "border-emerald-200 bg-emerald-100 text-emerald-800",
  paused: "border-amber-200 bg-amber-100 text-amber-800",
  finished: "border-neutral-300 bg-neutral-100 text-neutral-700",
};

/** Точка берёт только цвет текста плашки, без её фона и рамки. */
function textTone(classes: string) {
  return classes
    .split(" ")
    .filter((name) => name.startsWith("text-"))
    .join(" ");
}

export function ProjectQuickSelect(props: ProjectQuickSelectProps) {
  const [state, formAction, pending] = useActionState<
    QuickProjectFieldFormState,
    FormData
  >(updateProjectQuickField, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.error) formRef.current?.reset();
  }, [state]);

  const isHealth = props.field === "health";
  const values = isHealth ? PROJECT_HEALTH_VALUES : PROJECT_STAGE_VALUES;
  const fieldLabel = isHealth ? "статус" : "стадию";
  const colorClass = isHealth
    ? HEALTH_CLASS[props.value]
    : STAGE_CLASS[props.value];

  return (
    <form ref={formRef} action={formAction} className="inline-flex flex-col">
      <input type="hidden" name="id" value={props.projectId} />
      <input type="hidden" name="field" value={props.field} />
      <span
        className={cn(
          "relative inline-flex items-center",
          textTone(colorClass),
        )}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-1.5 -translate-y-1/2 rounded-full bg-current"
        />
        <Select
          key={props.value}
          name="value"
          defaultValue={props.value}
          disabled={pending}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          aria-label={`Изменить ${fieldLabel} проекта «${props.projectName}»`}
          title={state?.error ?? `Нажмите, чтобы изменить ${fieldLabel}`}
          className={cn(
            "h-7 w-auto min-w-0 cursor-pointer rounded-full border py-0 pr-6 pl-5 text-sm font-semibold shadow-none transition-colors hover:brightness-95 focus-visible:ring-2",
            colorClass,
          )}
        >
          {values.map((value) => (
            <option key={value} value={value}>
              {isHealth
                ? PROJECT_HEALTH_LABEL[value as Enums<"project_health">]
                : PROJECT_STAGE_LABEL[value as Enums<"project_stage">]}
            </option>
          ))}
        </Select>
      </span>
      <span aria-live="polite" className="sr-only">
        {pending
          ? `Сохраняем ${fieldLabel}`
          : state?.error
            ? state.error
            : state?.success
              ? "Изменение сохранено"
              : ""}
      </span>
      {state?.error && (
        <span className="mt-1 max-w-40 text-xs leading-tight text-red-600">
          {state.error}
        </span>
      )}
    </form>
  );
}
