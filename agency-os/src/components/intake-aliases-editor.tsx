"use client";

import { useActionState, useId } from "react";
import { saveIntakeAliases } from "@/app/(dashboard)/projects/intake-aliases-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function IntakeAliasesEditor({ kind, id, aliases }: { kind: "project" | "profile"; id: string; aliases: string[] }) {
  const [state, action, pending] = useActionState(saveIntakeAliases, undefined);
  const inputId = useId();
  return <form action={action} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4">
    <input type="hidden" name="kind" value={kind} />
    <input type="hidden" name="id" value={id} />
    <Label htmlFor={inputId}>{kind === "project" ? "Другие названия проекта" : "Как вы называете сотрудника"}</Label>
    <p id={`${inputId}-help`} className="text-sm text-neutral-500">По одному варианту на строке. Джарвис узнает {kind === "project" ? "проект" : "сотрудника"} по этим словам.</p>
    <Textarea id={inputId} aria-describedby={`${inputId}-help`} name="aliases" defaultValue={aliases.join("\n")} rows={3} maxLength={4000} />
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить названия"}</Button>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.success && <p role="status" className="text-sm text-emerald-700">Названия сохранены.</p>}
    </div>
  </form>;
}
