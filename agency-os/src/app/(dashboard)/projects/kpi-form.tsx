"use client";

import { useActionState } from "react";

import { addKpiEntry, type KpiFormState } from "@/app/(dashboard)/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/format";

export function KpiForm({ projectId }: { projectId: string }) {
  const action = addKpiEntry.bind(null, projectId);
  const [state, formAction, pending] = useActionState<KpiFormState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Field
        label="Дата"
        name="entry_date"
        type="date"
        defaultValue={todayISO()}
        required
        errors={state?.errors.entry_date}
      />
      <Field
        label="Расход"
        name="spend"
        type="number"
        step="0.01"
        min={0}
        errors={state?.errors.spend}
      />
      <Field
        label="Показы"
        name="impressions"
        type="number"
        min={0}
        errors={state?.errors.impressions}
      />
      <Field
        label="Клики"
        name="clicks"
        type="number"
        min={0}
        errors={state?.errors.clicks}
      />
      <Field
        label="Лиды"
        name="leads"
        type="number"
        min={0}
        errors={state?.errors.leads}
      />
      <Field
        label="Продажи"
        name="sales"
        type="number"
        min={0}
        errors={state?.errors.sales}
      />
      <Field
        label="Выручка"
        name="revenue"
        type="number"
        step="0.01"
        min={0}
        errors={state?.errors.revenue}
      />
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="comment">Комментарий</Label>
        <Textarea id="comment" name="comment" rows={2} />
      </div>
      <div className="col-span-2 sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Добавляем..." : "Добавить запись"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  errors,
  ...props
}: { label: string; name: string; errors?: string[] } & React.ComponentProps<
  "input"
>) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
      {errors?.map((error) => (
        <p key={error} className="text-xs text-red-600">
          {error}
        </p>
      ))}
    </div>
  );
}
