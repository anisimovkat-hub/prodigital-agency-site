import Link from "next/link";

import { TodayTable } from "@/app/(dashboard)/today/today-table";
import { FilterSelect } from "@/components/filter-select";
import { PersonalCalendarSchedule } from "@/components/personal-calendar";
import { TaskViewSwitcher } from "@/components/task-view-switcher";
import { dateISOInTimeZone } from "@/lib/calendar-events";
import { getPersonalCalendarEvents } from "@/lib/google-calendar";
import { isTaskOperational } from "@/lib/project-lifecycle";
import {
  filterProfilesByTaskAccess,
  filterTasksByAudience,
} from "@/lib/task-audience-filter";
import { sortTodayTasks } from "@/lib/today-sort";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type TodaySearch = { who?: string; assignee?: string };

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<TodaySearch>;
}) {
  const { who, assignee } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id ?? "";

  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "*, project:projects(id,name,stage), assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
      )
      .neq("status", "done")
      .neq("status", "cancelled"),
    supabase
      .from("profiles")
      .select("id,full_name,role,is_active")
      .order("full_name"),
  ]);

  const currentProfile = (profiles ?? []).find((profile) => profile.id === uid);
  const showPersonalCalendar =
    currentProfile?.role === "owner" && !assignee && who !== "team";
  const calendarToday = dateISOInTimeZone(new Date());
  const calendar = showPersonalCalendar
    ? await getPersonalCalendarEvents(calendarToday, calendarToday)
    : null;

  const filtered = filterTasksByAudience((tasks ?? []).filter(isTaskOperational), {
    userId: uid,
    who,
    assigneeId: assignee,
  });
  const audienceProfiles = filterProfilesByTaskAccess(
    (profiles ?? []).filter((profile) => profile.is_active !== false),
    (tasks ?? []).filter(isTaskOperational),
    {
      userId: uid,
      canViewAll: currentProfile?.role === "owner",
    },
  );

  const sorted = sortTodayTasks(filtered);

  const tabs: { key: string; label: string; href: string }[] = [
    { key: "all", label: "Все", href: "/today" },
    { key: "mine", label: "Мои", href: "/today?who=mine" },
    { key: "personal", label: "Личные", href: "/today?who=personal" },
    { key: "team", label: "Команда", href: "/today?who=team" },
  ];
  const activeKey = assignee ? "assignee" : who ?? "all";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Задачи</h1>
          <p className="text-sm text-neutral-500">
            День: просроченные, срочные и сегодняшние задачи.
          </p>
        </div>
        <TaskViewSwitcher />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-1 border-b border-neutral-200">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                activeKey === tab.key
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-800",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <FilterSelect
          name="assignee"
          label="Сотрудник"
          options={audienceProfiles.map((p) => ({
            value: p.id,
            label: p.full_name,
          }))}
        />
      </div>

      {calendar && calendar.events.length > 0 && (
        <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <PersonalCalendarSchedule
            events={calendar.events}
            timeZone={calendar.timeZone}
          />
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white py-16 text-center">
          <p className="text-base font-medium text-neutral-900">
            Здесь задач нет
          </p>
          <p className="text-sm text-neutral-500">
            По выбранному фильтру ничего не найдено.
          </p>
        </div>
      ) : (
        <TodayTable tasks={sorted} />
      )}
    </div>
  );
}
