import Link from "next/link";

import { TaskDoneCheckbox } from "@/components/task-done-checkbox";
import { PriorityBadge, TaskStatusBadge } from "@/components/badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, isOverdue } from "@/lib/format";
import { sortTodayTasks } from "@/lib/today-sort";
import { createClient } from "@/lib/supabase/server";

export default async function TodayPage() {
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "*, project:projects(id,name,client:clients(id,name)), assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
    )
    .neq("status", "done");

  const sorted = sortTodayTasks(tasks ?? []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Сегодня</h1>
        <p className="text-sm text-neutral-500">
          Просроченные, срочные и сегодняшние задачи по всем проектам.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white py-16 text-center">
          <p className="text-base font-medium text-neutral-900">
            Сегодня задач нет 🎉
          </p>
          <p className="text-sm text-neutral-500">
            Просроченных и срочных задач тоже нет. Можно выдохнуть.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Задача</TableHead>
              <TableHead>Проект</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead>Исполнитель</TableHead>
              <TableHead>Приоритет</TableHead>
              <TableHead>Дедлайн</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Сделано</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-medium text-neutral-900">
                  {task.title}
                </TableCell>
                <TableCell>
                  {task.project ? (
                    <Link
                      href={`/projects/${task.project.id}`}
                      className="hover:underline"
                    >
                      {task.project.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{task.project?.client?.name ?? "—"}</TableCell>
                <TableCell>{task.assignee?.full_name ?? "—"}</TableCell>
                <TableCell>
                  <PriorityBadge priority={task.priority ?? "medium"} />
                </TableCell>
                <TableCell>
                  <span
                    className={
                      isOverdue(task.due_date, task.status)
                        ? "text-red-600"
                        : ""
                    }
                  >
                    {formatDate(task.due_date)}
                  </span>
                </TableCell>
                <TableCell>
                  <TaskStatusBadge status={task.status ?? "todo"} />
                </TableCell>
                <TableCell>
                  <TaskDoneCheckbox taskId={task.id} done={false} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
