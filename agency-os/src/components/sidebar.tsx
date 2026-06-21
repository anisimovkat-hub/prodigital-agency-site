"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  FolderKanban,
  ListChecks,
  Users,
  Building2,
  LogOut,
  Menu,
  X,
} from "lucide-react";

import { logout } from "@/app/login/actions";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Дашборд", icon: LayoutDashboard },
  { href: "/today", label: "Сегодня", icon: CalendarCheck },
  { href: "/projects", label: "Проекты", icon: FolderKanban },
  { href: "/tasks", label: "Задачи", icon: ListChecks },
  { href: "/employees", label: "Сотрудники", icon: Users },
  { href: "/clients", label: "Клиенты", icon: Building2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 md:hidden">
        <span className="text-base font-semibold text-neutral-900">
          Agency OS
        </span>
        <button
          type="button"
          aria-label="Открыть меню"
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open && (
        <button
          type="button"
          aria-label="Закрыть меню"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-neutral-900/30 md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col border-r border-neutral-200 bg-white transition-transform md:static md:z-auto md:w-60 md:translate-x-0",
          open && "translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <span className="text-base font-semibold text-neutral-900">
            Agency OS
          </span>
          <button
            type="button"
            aria-label="Закрыть меню"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-neutral-400 hover:text-neutral-700 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <form action={logout} className="border-t border-neutral-200 p-3">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </form>
      </aside>
    </>
  );
}
