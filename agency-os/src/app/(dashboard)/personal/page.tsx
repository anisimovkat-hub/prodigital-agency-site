import Link from "next/link";

import { PersonalTaskForm } from "@/app/(dashboard)/personal/personal-form";
import { PriorityBadge, TaskStatusBadge } from "@/components/badges";
import { PersonalCalendarSchedule } from "@/components/personal-calendar";
import { TaskDoneCheckbox } from "@/components/task-done-checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, isOverdue } from "@/lib/format";
import { dateISOInTimeZone } from "@/lib/calendar-events";
import { getPersonalCalendarEvents } from "@/lib/google-calendar";
import {
  isExpiredPersonalCompletedTask,
  sortPersonalTasks,
} from "@/lib/personal-task-order";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

const TASK_SELECT =
  "id,title,description,status,priority,due_date,created_at, project:projects(id,name), assignee:profiles!tasks_assignee_id_fkey(id,full_name)";

type PersonalTask = {
  id: string;
  title: string;
  description: string | null;
  status: Enums<"task_status"> | null;
  priority: Enums<"task_priority"> | null;
  due_date: string | null;
  created_at: string | null;
  project: { id: string; name: string } | null;
  assignee: { id: string; full_name: string } | null;
};

export default async function PersonalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  // Личные проекты (флаг is_personal) — напр. «Личный бренд». RLS отдаёт их
  // только владельцу/участнику, поэтому клиентские проекты сюда не попадают.
  const { data: personalProjects } = await supabase
    .from("projects")
    .select("id")
    .eq("is_personal", true);
  const personalProjectIds = (personalProjects ?? []).map((p) => p.id);

  const [{ data: lifeTasks }, { data: brandTasks }, { data: profile }] =
    await Promise.all([
      // Личные дела: задачи без проекта, назначенные на меня
      supabase
        .from("tasks")
        .select(TASK_SELECT)
        .is("project_id", null)
        .eq("assignee_id", uid)
        .order("created_at", { ascending: false }),
      // Задачи личных проектов (личный бренд и т.п.)
      personalProjectIds.length > 0
        ? supabase
            .from("tasks")
            .select(TASK_SELECT)
            .in("project_id", personalProjectIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as PersonalTask[] }),
      supabase.from("profiles").select("role").eq("id", uid).maybeSingle(),
    ]);

  const calendarToday = dateISOInTimeZone(new Date());
  const tasks = sortPersonalTasks([
    ...((lifeTasks ?? []) as PersonalTask[]),
    ...((brandTasks ?? []) as PersonalTask[]),
  ]).filter(
    (task) => !isExpiredPersonalCompletedTask(task, calendarToday),
  );

  const calendar =
    profile?.role === "owner"
      ? await getPersonalCalendarEvents(calendarToday, calendarToday)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Личное</h1>
        <p className="text-sm text-neutral-500">
          Личные дела и проекты личного бренда, плюс ваше расписание. Клиентские
          проекты сюда не попадают — они в «Задачах» и «Проектах».
        </p>
      </div>

      {calendar && calendar.events.length > 0 && (
        <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <PersonalCalendarSchedule
            events={calendar.events}
            timeZone={calendar.timeZone}
            title="Моё расписание на сегодня"
          />
        </div>
      )}

      <details className="group rounded-lg border border-neutral-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
          + Новая личная задача
        </summary>
        <div className="mt-4">
          <PersonalTaskForm />
        </div>
      </details>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Задача</TableHead>
            <TableHead>Проект</TableHead>
            <TableHead>Приоритет</TableHead>
            <TableHead>Дедлайн</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Сделано</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 && (
            <TableEmpty colSpan={6}>
              Личных задач пока нет. Добавьте личное дело выше или задачу в
              проекте личного бренда.
            </TableEmpty>
          )}
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium text-neutral-900">
                <Link
                  href={`/tasks?task=${task.id}`}
                  className="hover:underline"
                >
                  {task.title}
                </Link>
                {task.description && (
                  <p className="mt-0.5 max-w-md truncate text-xs font-normal text-neutral-500">
                    {task.description}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-neutral-600">
                {task.project?.name ?? "Личное"}
              </TableCell>
              <TableCell>
                <PriorityBadge priority={task.priority ?? "medium"} />
              </TableCell>
              <TableCell>
                <span
                  className={
                    isOverdue(task.due_date, task.status) ? "text-red-600" : ""
                  }
                >
                  {formatDate(task.due_date)}
                </span>
              </TableCell>
              <TableCell>
                <TaskStatusBadge status={task.status ?? "todo"} />
              </TableCell>
              <TableCell>
                <TaskDoneCheckbox
                  taskId={task.id}
                  done={task.status === "done"}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
