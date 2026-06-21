"use client";

import { useActionState } from "react";

import { addClient, type CreateClientFormState } from "@/app/(dashboard)/clients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CLIENT_STATUS_LABEL } from "@/lib/labels";
import { CLIENT_STATUS_VALUES } from "@/lib/validation";

export function ClientForm() {
  const [state, formAction, pending] = useActionState<
    CreateClientFormState,
    FormData
  >(addClient, undefined);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="name">Название</Label>
        <Input id="name" name="name" required />
        <FieldErrors errors={state?.errors.name} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="status">Статус</Label>
        <Select id="status" name="status" defaultValue="active">
          {CLIENT_STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {CLIENT_STATUS_LABEL[value]}
            </option>
          ))}
        </Select>
        <FieldErrors errors={state?.errors.status} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="budget">Бюджет</Label>
        <Input id="budget" name="budget" type="number" step="0.01" min={0} />
        <FieldErrors errors={state?.errors.budget} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="phone">Телефон</Label>
        <Input id="phone" name="phone" type="tel" />
        <FieldErrors errors={state?.errors.phone} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" />
        <FieldErrors errors={state?.errors.email} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="telegram">Telegram</Label>
        <Input id="telegram" name="telegram" />
        <FieldErrors errors={state?.errors.telegram} />
      </div>

      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="notes">Заметки</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>

      <div className="col-span-2 sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Создаём..." : "Создать клиента"}
        </Button>
      </div>
    </form>
  );
}

function FieldErrors({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <>
      {errors.map((error) => (
        <p key={error} className="text-xs text-red-600">
          {error}
        </p>
      ))}
    </>
  );
}
