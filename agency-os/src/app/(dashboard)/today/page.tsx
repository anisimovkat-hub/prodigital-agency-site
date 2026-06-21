import Link from "next/link";

import { TaskDoneCheckbox } from "@/components/task-done-checkbox";
import { PriorityBadge, TaskStatusBadge } from "@/components/badges";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, isDueToday, isOverdue, todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function TodayPage() {
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "*, project:projects(id,name,client:clients(id,name)), assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
    )
    .neq("status", "done");

  const today = todayISO();

  function bucket(task: NonNullable<typeof tasks>[number]) {
    if (task.due_date && task.due_date < today) return 1;
    if (isDueToday(task.due_date)) return 2;
    if (task.priority === "urgent") return 3;
    if (task.is_important) return 4;
    if (task.priority === "high") return 5;
    return 6;
  }

  const sorted = [...(tasks ?? [])].sort((a, b) => {
    const bucketDiff = bucket(a) - bucket(b);
    if (bucketDiff !== 0) return bucketDiff;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Сегодня</h1>
        <p className="text-sm text-neutral-500">
          Просроченные, срочные и сегодняшние задачи по всем проектам.
        </p>
      </div>

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
          {sorted.length === 0 && <TableEmpty colSpan={8} />}
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
    </div>
  );
}
