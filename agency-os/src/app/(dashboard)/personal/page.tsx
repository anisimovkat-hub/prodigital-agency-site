import { PersonalTaskForm } from "@/app/(dashboard)/personal/personal-form";
import { PriorityBadge, TaskStatusBadge } from "@/components/badges";
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
import { createClient } from "@/lib/supabase/server";

export default async function PersonalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .is("project_id", null)
    .or(`creator_id.eq.${user!.id},assignee_id.eq.${user!.id}`)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Личное</h1>
        <p className="text-sm text-neutral-500">
          Ваши задачи без привязки к проектам агентства.
        </p>
      </div>

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
            <TableHead>Приоритет</TableHead>
            <TableHead>Дедлайн</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Сделано</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(tasks ?? []).length === 0 && (
            <TableEmpty colSpan={5}>Личных задач пока нет.</TableEmpty>
          )}
          {(tasks ?? []).map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium text-neutral-900">
                {task.title}
                {task.description && (
                  <p className="mt-0.5 max-w-md truncate text-xs font-normal text-neutral-500">
                    {task.description}
                  </p>
                )}
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
