import Link from "next/link";

import { PriorityBadge, TaskStatusBadge } from "@/components/badges";
import { ChecklistItemCheckbox } from "@/components/checklist-item-checkbox";
import { formatDate } from "@/lib/format";
import { TASK_TYPE_LABEL } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export async function TaskDrawer({
  taskId,
  closeHref,
}: {
  taskId: string;
  closeHref: string;
}) {
  const supabase = await createClient();

  const [{ data: task }, { data: checklist }, { data: comments }, { data: attachments }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "*, project:projects(id,name), assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
        )
        .eq("id", taskId)
        .maybeSingle(),
      supabase
        .from("task_checklist_items")
        .select("*")
        .eq("task_id", taskId)
        .order("position"),
      supabase
        .from("task_comments")
        .select("*, author:profiles(full_name)")
        .eq("task_id", taskId)
        .order("created_at"),
      supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at"),
    ]);

  if (!task) return null;

  return (
    <>
      <Link
        href={closeHref}
        aria-label="Закрыть"
        className="fixed inset-0 z-40 bg-neutral-900/30"
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-neutral-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">
            {task.title}
          </h2>
          <Link
            href={closeHref}
            className="shrink-0 text-neutral-400 hover:text-neutral-700"
          >
            ✕
          </Link>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <TaskStatusBadge status={task.status ?? "todo"} />
          <PriorityBadge priority={task.priority ?? "medium"} />
        </div>

        <dl className="mt-4 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-500">Проект</dt>
            <dd className="text-neutral-900">{task.project?.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Исполнитель</dt>
            <dd className="text-neutral-900">
              {task.assignee?.full_name ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Тип</dt>
            <dd className="text-neutral-900">
              {TASK_TYPE_LABEL[task.task_type ?? "other"]}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Дедлайн</dt>
            <dd className="text-neutral-900">{formatDate(task.due_date)}</dd>
          </div>
        </dl>

        {task.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-neutral-700">
            {task.description}
          </p>
        )}

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-neutral-900">Чеклист</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {(checklist ?? []).length === 0 && (
              <li className="text-sm text-neutral-400">Пусто</li>
            )}
            {(checklist ?? []).map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <ChecklistItemCheckbox
                  itemId={item.id}
                  done={item.is_done ?? false}
                />
                <span
                  className={
                    item.is_done
                      ? "text-neutral-400 line-through"
                      : "text-neutral-800"
                  }
                >
                  {item.title}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-neutral-900">
            Комментарии
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {(comments ?? []).length === 0 && (
              <li className="text-sm text-neutral-400">Комментариев нет</li>
            )}
            {(comments ?? []).map((comment) => (
              <li
                key={comment.id}
                className="rounded-md border border-neutral-200 p-2 text-sm"
              >
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>{comment.author?.full_name ?? "—"}</span>
                  <span>{formatDate(comment.created_at)}</span>
                </div>
                <p className="mt-1 text-neutral-800">{comment.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-semibold text-neutral-900">
            Вложения
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {(attachments ?? []).length === 0 && (
              <li className="text-sm text-neutral-400">Вложений нет</li>
            )}
            {(attachments ?? []).map((attachment) => (
              <li key={attachment.id}>
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-neutral-700 hover:underline"
                >
                  {attachment.title ?? attachment.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </>
  );
}
