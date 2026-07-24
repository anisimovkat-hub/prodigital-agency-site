"use client";

import { useActionState, useState } from "react";

import {
  createRecurringTask,
  type RecurringFormState,
} from "@/app/(dashboard)/recurring/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  RECURRING_FREQUENCY_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_TYPE_LABEL,
  WEEKDAY_LABEL,
} from "@/lib/labels";
import {
  RECURRING_FREQUENCY_VALUES,
  TASK_PRIORITY_VALUES,
  TASK_TYPE_VALUES,
  type RecurringFrequency,
} from "@/lib/validation";

type RecurringFormProps = {
  projects: { id: string; name: string }[];
  profiles: { id: string; full_name: string }[];
  anchorDate: string;
};

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

export function RecurringForm({
  projects,
  profiles,
  anchorDate,
}: RecurringFormProps) {
  const [state, formAction, pending] = useActionState<
    RecurringFormState,
    FormData
  >(createRecurringTask, undefined);
  const [frequency, setFrequency] =
    useState<RecurringFrequency>("daily");

  return (
    <form
      action={formAction}
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
    >
      <div className="md:col-span-2 xl:col-span-4">
        <Label htmlFor="recurring-title">Название задачи</Label>
        <Input id="recurring-title" name="title" className="mt-1" required />
        <FieldErrors errors={state?.errors?.title} />
      </div>

      <Field label="Проект" htmlFor="recurring-project">
        <Select id="recurring-project" name="project_id" defaultValue="">
          <option value="">Без проекта</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
        <FieldErrors errors={state?.errors?.project_id} />
      </Field>

      <Field label="Исполнитель" htmlFor="recurring-assignee">
        <Select id="recurring-assignee" name="assignee_id" defaultValue="">
          <option value="">Не назначен</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.full_name}
            </option>
          ))}
        </Select>
        <FieldErrors errors={state?.errors?.assignee_id} />
      </Field>

      <Field label="Направление" htmlFor="recurring-workstream">
        <Input
          id="recurring-workstream"
          name="workstream"
          placeholder="Например, Постинг"
        />
      </Field>

      <Field label="Частота" htmlFor="recurring-frequency">
        <Select
          id="recurring-frequency"
          name="frequency"
          value={frequency}
          onChange={(event) =>
            setFrequency(event.target.value as RecurringFrequency)
          }
        >
          {RECURRING_FREQUENCY_VALUES.map((value) => (
            <option key={value} value={value}>
              {RECURRING_FREQUENCY_LABEL[value]}
            </option>
          ))}
        </Select>
      </Field>

      {frequency === "weekly" && (
        <fieldset className="md:col-span-2 xl:col-span-4">
          <legend className="text-xs font-medium text-neutral-500">
            Дни недели
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <label
                key={day}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-700"
              >
                <input type="checkbox" name="weekdays" value={day} />
                {WEEKDAY_LABEL[day]}
              </label>
            ))}
          </div>
          <FieldErrors errors={state?.errors?.weekdays} />
        </fieldset>
      )}

      <Field label="Тип" htmlFor="recurring-type">
        <Select id="recurring-type" name="task_type" defaultValue="other">
          {TASK_TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {TASK_TYPE_LABEL[value]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Приоритет" htmlFor="recurring-priority">
        <Select
          id="recurring-priority"
          name="priority"
          defaultValue="medium"
        >
          {TASK_PRIORITY_VALUES.map((value) => (
            <option key={value} value={value}>
              {TASK_PRIORITY_LABEL[value]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={
          frequency === "every_other_day"
            ? "Первый день повтора"
            : "Дата отсчёта"
        }
        htmlFor="recurring-anchor"
      >
        <Input
          id="recurring-anchor"
          name="anchor_date"
          type="date"
          defaultValue={anchorDate}
          required
        />
        <FieldErrors errors={state?.errors?.anchor_date} />
      </Field>

      <div className="flex items-end md:col-span-2 xl:col-span-1">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Создаём..." : "Создать повтор"}
        </Button>
      </div>

      <div className="md:col-span-2 xl:col-span-4">
        <FieldErrors errors={state?.errors?._root} />
        {state?.success && (
          <p className="text-sm text-emerald-700">
            Шаблон создан и будет участвовать в ближайшей генерации.
          </p>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function FieldErrors({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return errors.map((error) => (
    <p key={error} className="mt-1 text-xs text-red-600">
      {error}
    </p>
  ));
}
