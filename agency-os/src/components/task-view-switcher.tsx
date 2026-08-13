"use client";

import { CalendarCheck, CalendarRange, ListChecks } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  taskViewForPath,
  taskViewHref,
  TASK_VIEW_STORAGE_KEY,
  type TaskView,
} from "@/lib/task-view";
import { cn } from "@/lib/utils";

const VIEWS = [
  { value: "day" as const, label: "День", icon: CalendarCheck },
  { value: "weeks" as const, label: "Недели", icon: CalendarRange },
  { value: "list" as const, label: "Список", icon: ListChecks },
];

export function TaskViewSwitcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = taskViewForPath(pathname);
  const audience = {
    who: searchParams.get("who"),
    assignee: searchParams.get("assignee"),
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(TASK_VIEW_STORAGE_KEY, active);
    } catch {
      // Переключатель продолжает работать без сохранения, если storage закрыт.
    }
  }, [active]);

  return (
    <nav
      aria-label="Вид задач"
      className="flex w-fit rounded-lg border border-neutral-200 bg-neutral-50 p-1"
    >
      {VIEWS.map(({ value, label, icon: Icon }) => (
        <Link
          key={value}
          href={taskViewHref(value, audience)}
          aria-current={active === value ? "page" : undefined}
          onClick={() => rememberView(value)}
          className={cn(
            "flex min-h-9 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
            active === value
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-500 hover:text-neutral-900",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function rememberView(view: TaskView) {
  try {
    window.localStorage.setItem(TASK_VIEW_STORAGE_KEY, view);
  } catch {
    // Навигация остаётся рабочей без localStorage.
  }
}
