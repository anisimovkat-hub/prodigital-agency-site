"use client";

import { useActionState } from "react";

import { createEmployee, type EmployeeFormState } from "@/app/(dashboard)/employees/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EmployeeForm() {
  const [state, action, pending] = useActionState<EmployeeFormState, FormData>(createEmployee, undefined);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-500">Карточка нужна для назначения задач и учёта загрузки. Регистрация и приглашение не требуются.</p>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Label htmlFor="employee-name">Имя сотрудника</Label>
          <Input id="employee-name" name="full_name" required maxLength={100} placeholder="Например, Виолетта" />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Label htmlFor="employee-position">Должность (необязательно)</Label>
          <Input id="employee-position" name="position_title" maxLength={150} placeholder="Например, специалист по рекламе" />
        </div>
        <Button type="submit" disabled={pending}>{pending ? "Добавляю…" : "Добавить сотрудника"}</Button>
      </form>
      {state && "error" in state && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state && "employee" in state && <p role="status" className="text-sm text-green-700">{state.employee.name}: карточка добавлена. Доступ в систему не подключён.</p>}
    </div>
  );
}
