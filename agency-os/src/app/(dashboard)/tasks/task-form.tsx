"use client";

import { useActionState } from "react";

import { createTask, type CreateTaskFormState } from "@/app/(dashboard)/tasks/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TASK_PRIORITY_LABEL, TASK_TYPE_LABEL } from "@/lib/labels";
import { TASK_PRIORITY_VALUES, TASK_TYPE_VALUES } from "@/lib/validation";

type TaskFormProps = {
  profiles: { id: string; full_name: string }[];
  defaultProjectId?: string;
  projects?: { id: string; name: string }[];
};

export function TaskForm({ profiles, defaultProjectId, projects }: TaskFormProps) {
  const [state, formAction, pending] = useActionState<
    CreateTaskFormState,
    FormData
  >(createTask, undefined);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="title">Название</Label>
        <Input id="title" name="title" required />
        <FieldErrors errors={state?.errors.title} />
      </div>

      {defaultProjectId ? (
        <input type="hidden" name="project_id" value={defaultProjectId} />
      ) : (
        <div className="flex flex-col gap-1">
          <Label htmlFor="project_id">Проект</Label>
          <Select id="project_id" name="project_id" defaultValue="" required>
            <option value="" disabled>
              Выберите проект
            </option>
            {(projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
          <FieldErrors errors={state?.errors.project_id} />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="assignee_id">Исполнитель</Label>
        <Select id="assignee_id" name="assignee_id" defaultValue="">
          <option value="">Не назначен</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.full_name}
            </option>
          ))}
        </Select>
        <FieldErrors errors={state?.errors.assignee_id} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="task_type">Тип</Label>
        <Select id="task_type" name="task_type" defaultValue="other">
          {TASK_TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {TASK_TYPE_LABEL[value]}
            </option>
          ))}
        </Select>
        <FieldErrors errors={state?.errors.task_type} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="priority">Приоритет</Label>
        <Select id="priority" name="priority" defaultValue="medium">
          {TASK_PRIORITY_VALUES.map((value) => (
            <option key={value} value={value}>
              {TASK_PRIORITY_LABEL[value]}
            </option>
          ))}
        </Select>
        <FieldErrors errors={state?.errors.priority} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="due_date">Дедлайн</Label>
        <Input id="due_date" name="due_date" type="date" />
        <FieldErrors errors={state?.errors.due_date} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="estimate_hours">Оценка, ч</Label>
        <Input
          id="estimate_hours"
          name="estimate_hours"
          type="number"
          min="0"
          step="0.25"
          inputMode="decimal"
        />
        <FieldErrors errors={state?.errors.estimate_minutes} />
      </div>

      <div className="col-span-2 flex items-end gap-4 pb-2 sm:col-span-4">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <Checkbox name="is_important" />
          Важно
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <Checkbox name="is_urgent" />
          Срочно
        </label>
      </div>

      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="description">Описание</Label>
        <Textarea id="description" name="description" rows={2} />
      </div>

      <div className="col-span-2 sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Создаём..." : "Создать задачу"}
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
