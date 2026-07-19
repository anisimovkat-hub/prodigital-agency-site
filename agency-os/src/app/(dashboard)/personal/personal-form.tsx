"use client";

import { useActionState } from "react";

import {
  createPersonalTask,
  type PersonalTaskFormState,
} from "@/app/(dashboard)/personal/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TASK_PRIORITY_LABEL } from "@/lib/labels";
import { TASK_PRIORITY_VALUES } from "@/lib/validation";

export function PersonalTaskForm() {
  const [state, formAction, pending] = useActionState<
    PersonalTaskFormState,
    FormData
  >(createPersonalTask, undefined);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="p_title">Название</Label>
        <Input id="p_title" name="title" required />
        {state?.errors.title?.map((e) => (
          <p key={e} className="text-xs text-red-600">{e}</p>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="p_priority">Приоритет</Label>
        <Select id="p_priority" name="priority" defaultValue="medium">
          {TASK_PRIORITY_VALUES.map((v) => (
            <option key={v} value={v}>
              {TASK_PRIORITY_LABEL[v]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="p_due">Дедлайн</Label>
        <Input id="p_due" name="due_date" type="date" />
      </div>
      <div className="col-span-2 flex flex-col gap-1 sm:col-span-4">
        <Label htmlFor="p_desc">Описание</Label>
        <Textarea id="p_desc" name="description" rows={2} />
      </div>
      <div className="col-span-2 sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Добавляем..." : "Добавить задачу"}
        </Button>
      </div>
    </form>
  );
}
