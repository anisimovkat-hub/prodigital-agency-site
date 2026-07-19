"use client";

import { useActionState } from "react";

import {
  createInvite,
  type InviteFormState,
} from "@/app/(dashboard)/employees/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { USER_ROLE_LABEL } from "@/lib/labels";

export function InviteForm({ signupUrl }: { signupUrl: string }) {
  const [state, formAction, pending] = useActionState<InviteFormState, FormData>(
    createInvite,
    undefined,
  );

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="inv_name">Имя (необязательно)</Label>
          <Input id="inv_name" name="full_name" placeholder="Имя сотрудника" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="inv_role">Роль</Label>
          <Select id="inv_role" name="role" defaultValue="specialist">
            <option value="specialist">{USER_ROLE_LABEL.specialist}</option>
            <option value="pm">{USER_ROLE_LABEL.pm}</option>
            <option value="viewer">{USER_ROLE_LABEL.viewer}</option>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Создаём..." : "Создать код"}
        </Button>
      </form>

      {state && "error" in state && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state && "code" in state && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
          <p className="font-medium text-green-900">
            Код приглашения: <code className="text-base">{state.code}</code>
          </p>
          <p className="mt-1 text-green-800">
            Отправьте сотруднику: «Зарегистрируйся на {signupUrl} с кодом{" "}
            <code>{state.code}</code>». Код одноразовый, действует 14 дней.
          </p>
        </div>
      )}
    </div>
  );
}
