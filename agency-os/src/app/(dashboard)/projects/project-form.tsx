"use client";

import { useActionState } from "react";

import { addProject, type CreateProjectFormState } from "@/app/(dashboard)/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_HEALTH_LABEL, PROJECT_STAGE_LABEL } from "@/lib/labels";
import { PROJECT_HEALTH_VALUES, PROJECT_STAGE_VALUES } from "@/lib/validation";

type ProjectFormProps = {
  clients: { id: string; name: string }[];
  profiles: { id: string; full_name: string }[];
};

export function ProjectForm({ clients, profiles }: ProjectFormProps) {
  const [state, formAction, pending] = useActionState<
    CreateProjectFormState,
    FormData
  >(addProject, undefined);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="name">Название</Label>
        <Input id="name" name="name" required />
        <FieldErrors errors={state?.errors.name} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="client_id">Клиент</Label>
        <Select id="client_id" name="client_id" defaultValue="" required>
          <option value="" disabled>
            Выберите клиента
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>
        <FieldErrors errors={state?.errors.client_id} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="responsible_id">Ответственный</Label>
        <Select id="responsible_id" name="responsible_id" defaultValue="">
          <option value="">Не назначен</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.full_name}
            </option>
          ))}
        </Select>
        <FieldErrors errors={state?.errors.responsible_id} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="health">Статус</Label>
        <Select id="health" name="health" defaultValue="green">
          {PROJECT_HEALTH_VALUES.map((value) => (
            <option key={value} value={value}>
              {PROJECT_HEALTH_LABEL[value]}
            </option>
          ))}
        </Select>
        <FieldErrors errors={state?.errors.health} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="stage">Стадия</Label>
        <Select id="stage" name="stage" defaultValue="active">
          {PROJECT_STAGE_VALUES.map((value) => (
            <option key={value} value={value}>
              {PROJECT_STAGE_LABEL[value]}
            </option>
          ))}
        </Select>
        <FieldErrors errors={state?.errors.stage} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="budget">Бюджет</Label>
        <Input id="budget" name="budget" type="number" step="0.01" min={0} />
        <FieldErrors errors={state?.errors.budget} />
      </div>

      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="short_comment">Краткий комментарий</Label>
        <Textarea id="short_comment" name="short_comment" rows={2} />
      </div>

      <div className="col-span-2 sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Создаём..." : "Создать проект"}
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
