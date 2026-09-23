"use client";

import { useActionState } from "react";

import {
  updateProject,
  type CreateProjectFormState,
} from "@/app/(dashboard)/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PROJECT_HEALTH_LABEL,
  PROJECT_OWNERSHIP_MODE_LABEL,
  PROJECT_STAGE_LABEL,
} from "@/lib/labels";
import type { Tables } from "@/lib/supabase/types";
import {
  PROJECT_HEALTH_VALUES,
  PROJECT_BRAND_COLOR_VALUES,
  PROJECT_OWNERSHIP_MODE_VALUES,
  PROJECT_STAGE_VALUES,
} from "@/lib/validation";

type ProjectEditFormProps = {
  project: Tables<"projects">;
  monthlyFee: number | null;
  isOwner: boolean;
  clients: { id: string; name: string }[];
  profiles: { id: string; full_name: string }[];
};

export function ProjectEditForm({
  project,
  monthlyFee,
  isOwner,
  clients,
  profiles,
}: ProjectEditFormProps) {
  const [state, formAction, pending] = useActionState<
    CreateProjectFormState,
    FormData
  >(updateProject, undefined);
  const savedProject =
    state?.success && state.project ? state.project : project;
  const formVersion = JSON.stringify([
    savedProject.id,
    savedProject.name,
    savedProject.client_id,
    savedProject.responsible_id,
    savedProject.health,
    savedProject.stage,
    savedProject.budget,
    savedProject.ownership_mode,
    state?.success ? state.project?.monthly_fee : monthlyFee,
    savedProject.short_comment,
    savedProject.logo_url,
    savedProject.brand_color,
  ]);

  return (
    <form
      key={formVersion}
      action={formAction}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <input type="hidden" name="id" value={savedProject.id} />
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="edit-name">Название</Label>
        <Input
          id="edit-name"
          name="name"
          defaultValue={savedProject.name}
          required
        />
        <FieldErrors errors={state?.errors?.name} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-client">Клиент</Label>
        <Select
          id="edit-client"
          name="client_id"
          defaultValue={savedProject.client_id ?? ""}
          required
        >
          <option value="" disabled>
            Выберите клиента
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>
        <FieldErrors errors={state?.errors?.client_id} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-responsible">Ответственный</Label>
        <Select
          id="edit-responsible"
          name="responsible_id"
          defaultValue={savedProject.responsible_id ?? ""}
        >
          <option value="">Не назначен</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.full_name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-health">Статус</Label>
        <Select
          id="edit-health"
          name="health"
          defaultValue={savedProject.health ?? "green"}
        >
          {PROJECT_HEALTH_VALUES.map((value) => (
            <option key={value} value={value}>
              {PROJECT_HEALTH_LABEL[value]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-stage">Стадия</Label>
        <Select
          id="edit-stage"
          name="stage"
          defaultValue={savedProject.stage ?? "active"}
        >
          {PROJECT_STAGE_VALUES.map((value) => (
            <option key={value} value={value}>
              {PROJECT_STAGE_LABEL[value]}
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
          defaultValue={savedProject.budget ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-mode">Режим ведения</Label>
        <Select
          id="edit-mode"
          name="ownership_mode"
          defaultValue={savedProject.ownership_mode ?? ""}
        >
          <option value="">— не задан</option>
          {PROJECT_OWNERSHIP_MODE_VALUES.map((value) => (
            <option key={value} value={value}>
              {PROJECT_OWNERSHIP_MODE_LABEL[value]}
            </option>
          ))}
        </Select>
      </div>

      {isOwner && <div className="flex flex-col gap-1">
        <Label htmlFor="edit-monthly-fee">Доход/мес, ₽</Label>
        <Input
          id="edit-monthly-fee"
          name="monthly_fee"
          type="number"
          step="0.01"
          min={0}
          defaultValue={state?.success ? (state.project?.monthly_fee ?? "") : (monthlyFee ?? "")}
        />
      </div>}

      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="edit-logo">Логотип (ссылка на изображение)</Label>
        <Input
          id="edit-logo"
          name="logo_url"
          type="url"
          placeholder="https://…"
          defaultValue={savedProject.logo_url ?? ""}
        />
        <FieldErrors errors={state?.errors?.logo_url} />
      </div>

      <fieldset className="col-span-2 flex flex-col gap-2 sm:col-span-4">
        <legend className="text-sm font-medium text-neutral-900">Цвет проекта</legend>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer">
            <input className="peer sr-only" type="radio" name="brand_color" value="" defaultChecked={!savedProject.brand_color} />
            <span className="flex h-7 items-center rounded-md border border-neutral-300 px-2 text-xs text-neutral-600 peer-checked:border-neutral-900 peer-checked:ring-2 peer-checked:ring-neutral-300">Авто</span>
          </label>
          {PROJECT_BRAND_COLOR_VALUES.map((color) => (
            <label key={color} className="cursor-pointer">
              <input aria-label={`Выбрать цвет ${color}`} className="peer sr-only" type="radio" name="brand_color" value={color} defaultChecked={savedProject.brand_color === color} />
              <span aria-label={`Выбрать цвет ${color}`} className="block size-7 rounded-full border-2 border-white shadow-sm ring-1 ring-neutral-200 peer-checked:ring-2 peer-checked:ring-neutral-950" style={{ backgroundColor: color }} />
            </label>
          ))}
        </div>
        <FieldErrors errors={state?.errors?.brand_color} />
      </fieldset>

      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="edit-comment">Краткий комментарий</Label>
        <Textarea
          id="edit-comment"
          name="short_comment"
          rows={2}
          defaultValue={savedProject.short_comment ?? ""}
        />
      </div>

      <div className="col-span-2 sm:col-span-4">
        <FieldErrors errors={state?.errors?._root} />
        <Button
          type="submit"
          disabled={pending}
          className="bg-emerald-800 text-white hover:bg-emerald-700"
        >
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
          {state?.success ? "Изменения проекта сохранены" : ""}
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
