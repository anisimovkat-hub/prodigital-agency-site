import Link from "next/link";

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
import type { Enums } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type PersonalTask = {
  id: string;
  title: string;
  description: string | null;
  status: Enums<"task_status"> | null;
  priority: Enums<"task_priority"> | null;
  due_date: string | null;
  project: { id: string; name: string } | null;
  assignee: { id: string; full_name: string } | null;
};

export default async function PersonalPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const delegated = view === "delegated";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const { data: mine } = await supabase
    .from("tasks")
    .select(
      "id,title,description,status,priority,due_date, project:projects(id,name), assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
    )
    .is("project_id", null)
    .eq("assignee_id", uid)
    .order("created_at", { ascending: false });

  const { data: handed } = await supabase
    .from("tasks")
    .select(
      "id,title,description,status,priority,due_date, project:projects(id,name), assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
    )
    .eq("creator_id", uid)
    .neq("assignee_id", uid)
    .not("assignee_id", "is", null)
    .order("created_at", { ascending: false });

  const tasks = (delegated ? handed : mine) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Личное</h1>
        <p className="text-sm text-neutral-500">
          Ваши задачи и то, что вы делегировали коллегам.
        </p>
      </div>

      <div className="flex gap-1 border-b border-neutral-200">
        <Tab href="/personal" active={!delegated}>
          Мои ({(mine ?? []).length})
        </Tab>
        <Tab href="/personal?view=delegated" active={delegated}>
          Делегированные ({(handed ?? []).length})
        </Tab>
      </div>

      {!delegated && (
        <details className="group rounded-lg border border-neutral-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
            + Новая личная задача
          </summary>
          <div className="mt-4">
            <PersonalTaskForm />
          </div>
        </details>
      )}

      {delegated && (
        <p className="text-sm text-neutral-500">
          Задачи, которые вы создали и назначили на другого сотрудника. Чтобы
          делегировать любую задачу — откройте её и смените «Исполнителя».
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Задача</TableHead>
            {delegated && <TableHead>Проект</TableHead>}
            {delegated && <TableHead>Исполнитель</TableHead>}
            <TableHead>Приоритет</TableHead>
            <TableHead>Дедлайн</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Сделано</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 && (
            <TableEmpty colSpan={delegated ? 7 : 5}>
              {delegated
                ? "Делегированных задач пока нет."
                : "Личных задач пока нет."}
            </TableEmpty>
          )}
          {(tasks as PersonalTask[]).map((task) => (
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
              {delegated && (
                <TableCell>{task.project?.name ?? "Личное"}</TableCell>
              )}
              {delegated && (
                <TableCell>{task.assignee?.full_name ?? "—"}</TableCell>
              )}
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

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-neutral-900 text-neutral-900"
          : "border-transparent text-neutral-500 hover:text-neutral-800",
      )}
    >
      {children}
    </Link>
  );
}
