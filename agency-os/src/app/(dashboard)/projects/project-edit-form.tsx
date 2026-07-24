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
import { PROJECT_HEALTH_LABEL, PROJECT_STAGE_LABEL } from "@/lib/labels";
import type { Tables } from "@/lib/supabase/types";
import { PROJECT_HEALTH_VALUES, PROJECT_STAGE_VALUES } from "@/lib/validation";

type ProjectEditFormProps = {
  project: Tables<"projects">;
  clients: { id: string; name: string }[];
  profiles: { id: string; full_name: string }[];
};

export function ProjectEditForm({
  project,
  clients,
  profiles,
}: ProjectEditFormProps) {
  const [state, formAction, pending] = useActionState<
    CreateProjectFormState,
    FormData
  >(updateProject, undefined);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <input type="hidden" name="id" value={project.id} />
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="edit-name">Название</Label>
        <Input
          id="edit-name"
          name="name"
          defaultValue={project.name}
          required
        />
        <FieldErrors errors={state?.errors.name} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-client">Клиент</Label>
        <Select
          id="edit-client"
          name="client_id"
          defaultValue={project.client_id ?? ""}
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
        <FieldErrors errors={state?.errors.client_id} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="edit-responsible">Ответственный</Label>
        <Select
          id="edit-responsible"
          name="responsible_id"
          defaultValue={project.responsible_id ?? ""}
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
          defaultValue={project.health ?? "green"}
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
          defaultValue={project.stage ?? "active"}
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
          defaultValue={project.budget ?? ""}
        />
      </div>

      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="edit-comment">Краткий комментарий</Label>
        <Textarea
          id="edit-comment"
          name="short_comment"
          rows={2}
          defaultValue={project.short_comment ?? ""}
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
