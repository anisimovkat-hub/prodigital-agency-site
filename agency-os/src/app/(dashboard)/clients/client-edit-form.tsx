"use client";

import { useActionState } from "react";

import {
  updateClient,
  type ClientEditFormState,
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
    ClientEditFormState,
    FormData
  >(updateClient, undefined);
  const savedClient = state?.success ? state.client : client;
  const formVersion = JSON.stringify([
    savedClient.id,
    savedClient.name,
    savedClient.status,
    savedClient.budget,
    savedClient.phone,
    savedClient.email,
    savedClient.telegram,
    savedClient.notes,
  ]);

  return (
    <form
      key={formVersion}
      action={formAction}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <input type="hidden" name="id" value={savedClient.id} />
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="edit-name">Название</Label>
        <Input
          id="edit-name"
          name="name"
          defaultValue={savedClient.name}
          required
        />
        <FieldErrors errors={state?.errors?.name} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-status">Статус</Label>
        <Select
          id="edit-status"
          name="status"
          defaultValue={savedClient.status ?? "active"}
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
          defaultValue={savedClient.budget ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-phone">Телефон</Label>
        <Input
          id="edit-phone"
          name="phone"
          type="tel"
          defaultValue={savedClient.phone ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-email">Email</Label>
        <Input
          id="edit-email"
          name="email"
          type="email"
          defaultValue={savedClient.email ?? ""}
        />
        <FieldErrors errors={state?.errors?.email} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-telegram">Telegram</Label>
        <Input
          id="edit-telegram"
          name="telegram"
          defaultValue={savedClient.telegram ?? ""}
        />
      </div>

      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="edit-notes">Заметки</Label>
        <Textarea
          id="edit-notes"
          name="notes"
          rows={2}
          defaultValue={savedClient.notes ?? ""}
        />
      </div>

      <div className="col-span-2 sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняем..." : "Сохранить изменения"}
        </Button>
        <p
          aria-live="polite"
          className={
            state?.success
              ? "mt-2 text-sm font-medium text-emerald-700"
              : "sr-only"
          }
        >
          {state?.success ? "Изменения клиента сохранены" : ""}
        </p>
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
