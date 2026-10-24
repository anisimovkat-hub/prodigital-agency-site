"use client";

import { useActionState, useId } from "react";
import Link from "next/link";

import { addProject, type CreateProjectFormState } from "@/app/(dashboard)/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_HEALTH_LABEL, PROJECT_STAGE_LABEL } from "@/lib/labels";
import { PROJECT_BRAND_COLOR_VALUES, PROJECT_HEALTH_VALUES, PROJECT_STAGE_VALUES } from "@/lib/validation";

type ProjectFormProps = {
  clients: { id: string; name: string }[];
  profiles: { id: string; full_name: string }[];
  fixedClient?: { id: string; name: string };
};

export function ProjectForm({ clients, profiles, fixedClient }: ProjectFormProps) {
  const [state, formAction, pending] = useActionState<
    CreateProjectFormState,
    FormData
  >(addProject, undefined);
  const formId = useId();
  const fieldId = (name: string) => `${formId}-${name}`;

  return (
    <form action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor={fieldId("name")}>Название проекта</Label>
        <Input id={fieldId("name")} name="name" required />
        <FieldErrors errors={state?.errors?.name} />
      </div>

      <div className="flex flex-col gap-1">
        {fixedClient ? <>
          <span className="text-sm font-medium">Клиент</span>
          <input type="hidden" name="client_id" value={fixedClient.id} />
          <p className="flex h-9 items-center text-sm text-neutral-700">{fixedClient.name}</p>
        </> : <>
        <Label htmlFor={fieldId("client_id")}>Клиент</Label>
        <Select id={fieldId("client_id")} name="client_id" defaultValue="" required>
          <option value="" disabled>
            Выберите клиента
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>
        </>}
        <FieldErrors errors={state?.errors?.client_id} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId("responsible_id")}>Ответственный</Label>
        <Select id={fieldId("responsible_id")} name="responsible_id" defaultValue="">
          <option value="">Не назначен</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.full_name}
            </option>
          ))}
        </Select>
        <FieldErrors errors={state?.errors?.responsible_id} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId("health")}>Статус</Label>
        <Select id={fieldId("health")} name="health" defaultValue="green">
          {PROJECT_HEALTH_VALUES.map((value) => (
            <option key={value} value={value}>
              {PROJECT_HEALTH_LABEL[value]}
            </option>
          ))}
        </Select>
        <FieldErrors errors={state?.errors?.health} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId("stage")}>Стадия</Label>
        <Select id={fieldId("stage")} name="stage" defaultValue="active">
          {PROJECT_STAGE_VALUES.map((value) => (
            <option key={value} value={value}>
              {PROJECT_STAGE_LABEL[value]}
            </option>
          ))}
        </Select>
        <FieldErrors errors={state?.errors?.stage} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId("budget")}>Бюджет</Label>
        <Input id={fieldId("budget")} name="budget" type="number" step="0.01" min={0} />
        <FieldErrors errors={state?.errors?.budget} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId("monthly_fee")}>Доход/мес, ₽ (только владелец)</Label>
        <Input id={fieldId("monthly_fee")} name="monthly_fee" type="number" step="0.01" min={0} />
        <FieldErrors errors={state?.errors?.monthly_fee} />
      </div>

      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor={fieldId("logo_url")}>Логотип (ссылка на изображение)</Label>
        <Input id={fieldId("logo_url")} name="logo_url" type="url" placeholder="https://…" />
        <FieldErrors errors={state?.errors?.logo_url} />
      </div>

      <fieldset className="col-span-2 flex flex-col gap-2 sm:col-span-4">
        <legend className="text-sm font-medium text-neutral-900">Цвет проекта</legend>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer">
            <input className="peer sr-only" type="radio" name="brand_color" value="" defaultChecked />
            <span className="flex h-7 items-center rounded-md border border-neutral-300 px-2 text-xs text-neutral-600 peer-checked:border-neutral-900 peer-checked:ring-2 peer-checked:ring-neutral-300">Авто</span>
          </label>
          {PROJECT_BRAND_COLOR_VALUES.map((color) => (
            <label key={color} className="cursor-pointer">
              <input aria-label={`Выбрать цвет ${color}`} className="peer sr-only" type="radio" name="brand_color" value={color} />
              <span aria-label={`Выбрать цвет ${color}`} className="block size-7 rounded-full border-2 border-white shadow-sm ring-1 ring-neutral-200 peer-checked:ring-2 peer-checked:ring-neutral-950" style={{ backgroundColor: color }} />
            </label>
          ))}
        </div>
        <FieldErrors errors={state?.errors?.brand_color} />
      </fieldset>

      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor={fieldId("short_comment")}>Краткий комментарий</Label>
        <Textarea id={fieldId("short_comment")} name="short_comment" rows={2} />
      </div>

      <div className="col-span-2 sm:col-span-4">
        <FieldErrors errors={state?.errors?._root} />
        <Button type="submit" disabled={pending}>
          {pending ? "Создаём..." : "Создать проект"}
        </Button>
        {state?.success && state.createdProject && <p role="status" className="mt-3 text-sm text-emerald-700">
          Проект «{state.createdProject.name}» создан. <Link href={`/projects/${state.createdProject.id}`} className="font-medium underline underline-offset-2">Открыть проект</Link>
        </p>}
        {state?.success && state.warning && <p role="alert" className="mt-2 text-sm text-amber-800">{state.warning}</p>}
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
