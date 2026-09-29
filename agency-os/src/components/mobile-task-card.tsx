import Link from "next/link";
import { TaskDueDateCell } from "@/app/(dashboard)/tasks/task-due-date-cell";
import { TaskQuickSelect } from "@/app/(dashboard)/tasks/task-quick-select";
import { PriorityBadge, TaskStatusBadge } from "@/components/badges";
import { ProjectBadge } from "@/components/project-badge";
import { TaskDoneCheckbox } from "@/components/task-done-checkbox";
import { TASK_TYPE_LABEL } from "@/lib/labels";
import type { Enums } from "@/lib/supabase/types";

type MobileTask = {
  id: string;
  title: string;
  status: Enums<"task_status"> | null;
  priority: Enums<"task_priority"> | null;
  due_date: string | null;
  project: { id: string; name: string } | null;
  assignee?: { id: string; full_name: string } | null;
  assignee_id?: string | null;
  is_important?: boolean | null;
  is_urgent?: boolean | null;
  task_type?: Enums<"task_type"> | null;
};

export function MobileTaskCard({ task, href, profiles, duration }: {
  task: MobileTask;
  href: string;
  profiles?: { id: string; name: string }[];
  duration?: string;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md focus-within:ring-2 focus-within:ring-blue-500">
          <TaskDoneCheckbox taskId={task.id} done={task.status === "done"} label={`${task.status === "done" ? "Вернуть в активные" : "Завершить"}: ${task.title}`} />
        </label>
        <Link href={href} className="flex min-h-11 min-w-0 flex-1 items-center break-words py-2 text-sm font-semibold leading-relaxed text-neutral-900 hover:underline">{task.title}</Link>
      </div>
      <Link href={task.project ? `/projects/${task.project.id}` : "/personal"} className="mt-1 inline-flex max-w-full py-1">
        <ProjectBadge projectId={task.project?.id} name={task.project?.name} className="max-w-full" />
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <TaskStatusBadge status={task.status ?? "todo"} />
        {task.is_urgent && <span className="text-xs font-semibold text-red-700">Срочно</span>}
        {task.is_important && <span className="text-xs font-semibold text-amber-700">Важно</span>}
        {task.task_type && <span className="text-xs text-neutral-500">{TASK_TYPE_LABEL[task.task_type]}</span>}
        {duration && <span className="text-xs text-neutral-500">Затрачено: {duration}</span>}
      </div>
      {profiles ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="min-w-0"><p className="mb-1 text-xs text-neutral-500">Исполнитель</p><TaskQuickSelect taskId={task.id} taskTitle={task.title} field="assignee_id" value={task.assignee_id ?? task.assignee?.id ?? null} options={profiles} /></div>
          <div className="min-w-0"><p className="mb-1 text-xs text-neutral-500">Приоритет</p><TaskQuickSelect taskId={task.id} taskTitle={task.title} field="priority" value={task.priority} /></div>
        </div>
      ) : <div className="mt-2"><PriorityBadge priority={task.priority ?? "medium"} /></div>}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-2"><span className="text-xs text-neutral-500">Дедлайн</span><TaskDueDateCell taskId={task.id} taskTitle={task.title} dueDate={task.due_date} status={task.status} /></div>
    </article>
  );
}
