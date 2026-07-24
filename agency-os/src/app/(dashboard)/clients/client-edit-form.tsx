"use client";

import { useActionState } from "react";

import {
  updateClient,
  type CreateClientFormState,
} from "@/app/(dashboard)/clients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CLIENT_STATUS_LABEL } from "@/lib/labels";
import type { Tables } from "@/lib/supabase/types";
import { CLIENT_STATUS_VALUES } from "@/lib/validation";

export function ClientEditForm({ client }: { client: Tables<"clients"> }) {
  const [state, formAction, pending] = useActionState<
    CreateClientFormState,
    FormData
  >(updateClient, undefined);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <input type="hidden" name="id" value={client.id} />
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="edit-name">Название</Label>
        <Input id="edit-name" name="name" defaultValue={client.name} required />
        <FieldErrors errors={state?.errors.name} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-status">Статус</Label>
        <Select
          id="edit-status"
          name="status"
          defaultValue={client.status ?? "active"}
        >
          {CLIENT_STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {CLIENT_STATUS_LABEL[value]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-budget">Бюджет</Label>
        <Input
          id="edit-budget"
          name="budget"
          type="number"
          step="0.01"
          min={0}
          defaultValue={client.budget ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-phone">Телефон</Label>
        <Input
          id="edit-phone"
          name="phone"
          type="tel"
          defaultValue={client.phone ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-email">Email</Label>
        <Input
          id="edit-email"
          name="email"
          type="email"
          defaultValue={client.email ?? ""}
        />
        <FieldErrors errors={state?.errors.email} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-telegram">Telegram</Label>
        <Input
          id="edit-telegram"
          name="telegram"
          defaultValue={client.telegram ?? ""}
        />
      </div>

      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="edit-notes">Заметки</Label>
        <Textarea
          id="edit-notes"
          name="notes"
          rows={2}
          defaultValue={client.notes ?? ""}
        />
      </div>

      <div className="col-span-2 sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняем..." : "Сохранить изменения"}
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
