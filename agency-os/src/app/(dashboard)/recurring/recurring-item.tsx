"use client";

import { useActionState, useState } from "react";

import {
  toggleRecurringTask,
  updateRecurringSchedule,
  type RecurringFormState,
} from "@/app/(dashboard)/recurring/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  RECURRING_FREQUENCY_LABEL,
  WEEKDAY_LABEL,
} from "@/lib/labels";
import {
  RECURRING_FREQUENCY_VALUES,
  type RecurringFrequency,
} from "@/lib/validation";

type RecurringItemProps = {
  recurringTask: {
    id: string;
    frequency: RecurringFrequency;
    weekdays: number[] | null;
    anchor_date: string;
    is_active: boolean;
  };
  canManage: boolean;
};

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

export function RecurringItem({
  recurringTask,
  canManage,
}: RecurringItemProps) {
  const [frequency, setFrequency] = useState(recurringTask.frequency);
  const [scheduleState, scheduleAction, schedulePending] = useActionState<
    RecurringFormState,
    FormData
  >(updateRecurringSchedule, undefined);
  const [toggleState, toggleAction, togglePending] = useActionState<
    RecurringFormState,
    FormData
  >(toggleRecurringTask, undefined);

  if (!canManage) {
    return (
      <p className="text-sm text-neutral-600">
        {formatSchedule(
          recurringTask.frequency,
          recurringTask.weekdays,
          recurringTask.anchor_date,
        )}
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <form action={scheduleAction} className="grid gap-3">
        <input type="hidden" name="id" value={recurringTask.id} />
        <label className="grid gap-1 text-xs font-medium text-neutral-500">
          Частота
          <Select
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
        </label>

        {frequency === "weekly" && (
          <fieldset>
            <legend className="text-xs font-medium text-neutral-500">
              Дни недели
            </legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => (
                <label
                  key={day}
                  className="flex cursor-pointer items-center gap-1 rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-700"
                >
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={day}
                    defaultChecked={recurringTask.weekdays?.includes(day)}
                  />
                  {WEEKDAY_LABEL[day]}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {frequency === "every_other_day" ? (
          <label className="grid gap-1 text-xs font-medium text-neutral-500">
            Первый день повтора
            <Input
              name="anchor_date"
              type="date"
              defaultValue={recurringTask.anchor_date}
              required
            />
          </label>
        ) : (
          <input
            type="hidden"
            name="anchor_date"
            value={recurringTask.anchor_date}
          />
        )}

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={schedulePending}
          >
            {schedulePending ? "Сохраняем..." : "Сохранить частоту"}
          </Button>
          {scheduleState?.success && (
            <span className="text-xs text-emerald-700">Сохранено</span>
          )}
        </div>
        <Errors errors={scheduleState?.errors} />
      </form>

      <form action={toggleAction}>
        <input type="hidden" name="id" value={recurringTask.id} />
        <input
          type="hidden"
          name="is_active"
          value={recurringTask.is_active ? "false" : "true"}
        />
        <Button
          type="submit"
          size="sm"
          variant={recurringTask.is_active ? "outline" : "default"}
          disabled={togglePending}
        >
          {togglePending
            ? "Меняем..."
            : recurringTask.is_active
              ? "Поставить на паузу"
              : "Включить"}
        </Button>
        <Errors errors={toggleState?.errors} />
      </form>
    </div>
  );
}

function formatSchedule(
  frequency: RecurringFrequency,
  weekdays: number[] | null,
  anchorDate: string,
) {
  if (frequency === "weekly") {
    const days = WEEKDAYS.filter((day) => weekdays?.includes(day))
      .map((day) => WEEKDAY_LABEL[day])
      .join(", ");
    return days
      ? `${RECURRING_FREQUENCY_LABEL[frequency]}: ${days}`
      : RECURRING_FREQUENCY_LABEL[frequency];
  }
  if (frequency === "every_other_day") {
    return `${RECURRING_FREQUENCY_LABEL[frequency]} с ${new Date(
      `${anchorDate}T00:00:00Z`,
    ).toLocaleDateString("ru-RU", { timeZone: "UTC" })}`;
  }
  return RECURRING_FREQUENCY_LABEL[frequency];
}

function Errors({
  errors,
}: {
  errors?: Record<string, string[]>;
}) {
  if (!errors) return null;
  return Object.values(errors)
    .flat()
    .map((error) => (
      <p key={error} className="mt-1 text-xs text-red-600">
        {error}
      </p>
    ));
}
