"use client";

import { type MouseEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  SquareKanban,
  FolderKanban,
  ListChecks,
  UserRound,
  Users,
  Building2,
  Repeat2,
  ChartNoAxesCombined,
  LogOut,
  Menu,
  X,
} from "lucide-react";

import { logout } from "@/app/login/actions";
import {
  normalizeTaskView,
  taskViewHref,
  TASK_VIEW_STORAGE_KEY,
} from "@/lib/task-view";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Дашборд", icon: LayoutDashboard },
  { href: "/tasks", label: "Задачи", icon: ListChecks },
  { href: "/board", label: "Доска", icon: SquareKanban },
  { href: "/projects", label: "Проекты", icon: FolderKanban },
  { href: "/time", label: "Трудозатраты", icon: ChartNoAxesCombined },
  { href: "/recurring", label: "Повторы", icon: Repeat2 },
  { href: "/personal", label: "Личное", icon: UserRound },
  { href: "/employees", label: "Сотрудники", icon: Users },
  { href: "/clients", label: "Клиенты", icon: Building2 },
  { href: "/analytics", label: "Аналитика", icon: ChartNoAxesCombined },
];

export function Sidebar({
  mobileEnabled = false,
  overdueCount = 0,
}: {
  mobileEnabled?: boolean;
  overdueCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const menuButton = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = menuButton.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menuPanel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const items = Array.from(menuPanel.current?.querySelectorAll<HTMLElement>("a, button") ?? []);
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  function handleNavClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    setOpen(false);
    if (href !== "/tasks") return;
    try {
      const target = taskViewHref(
        normalizeTaskView(window.localStorage.getItem(TASK_VIEW_STORAGE_KEY)),
      );
      if (target !== href) {
        event.preventDefault();
        router.push(target);
      }
    } catch {
      // Без storage ссылка ведёт в обычный список задач.
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-nav px-4 py-3 md:hidden">
        <span className="text-base font-semibold text-white">
          Agency OS
        </span>
        <button
          type="button"
          ref={menuButton}
          aria-label="Открыть меню"
          aria-expanded={open}
          aria-controls="main-menu"
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-nav-ink hover:bg-white/10 hover:text-white"
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
        ref={menuPanel}
        id="main-menu"
        className={cn(
          "mobile-sidebar invisible fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col bg-nav text-nav-ink transition-transform md:sticky md:top-0 md:h-dvh md:visible md:z-auto md:w-60 md:translate-x-0",
          open && "visible translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <span className="flex items-center gap-2.5 text-base font-semibold text-white">
            <span aria-hidden="true" className="grid size-7 place-items-center rounded-lg bg-blue-600 text-xs font-bold">
              OS
            </span>
            Agency OS
          </span>
          <button
            type="button"
            aria-label="Закрыть меню"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-nav-ink hover:bg-white/10 hover:text-white md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/"
                ? pathname === "/"
                : href === "/tasks"
                  ? ["/tasks", "/today", "/week"].some((prefix) =>
                      pathname.startsWith(prefix),
                    )
                  : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={(event) => handleNavClick(event, href)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-nav-ink hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {href === "/tasks" && overdueCount > 0 && (
                  <span
                    className="ml-auto min-w-5 rounded-full bg-red-600 px-1.5 text-center text-[11px] leading-5 font-semibold text-white"
                    aria-label={`Просрочено: ${overdueCount}`}
                    title="Мои просроченные задачи"
                  >
                    {overdueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <form action={logout} className="border-t border-white/10 p-3">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-nav-ink transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </form>
      </aside>
      {mobileEnabled && (
        <nav aria-label="Быстрые переходы" className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-neutral-200 bg-white md:hidden">
          {NAV_ITEMS.filter(({ href }) => ["/", "/tasks", "/projects", "/personal"].includes(href)).map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : href === "/tasks" ? ["/tasks", "/today", "/week"].some((prefix) => pathname.startsWith(prefix)) : pathname.startsWith(href);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={(event) => handleNavClick(event, href)} className={cn("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-blue-700" : "text-neutral-500")}><span className="relative"><Icon className="size-5" aria-hidden />{href === "/tasks" && overdueCount > 0 && <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-semibold text-white" aria-label={`Просрочено: ${overdueCount}`}>{overdueCount}</span>}</span>{href === "/" ? "Главная" : label}</Link>;
          })}
          <button type="button" onClick={() => setOpen(true)} aria-label="Открыть все разделы" className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-neutral-500"><Menu className="size-5" aria-hidden />Ещё</button>
        </nav>
      )}
    </>
  );
}
