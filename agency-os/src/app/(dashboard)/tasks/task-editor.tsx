"use client";

import {
  ExternalLink,
  Link2,
  ListChecks,
  ListTree,
  MessageSquare,
  Paperclip,
  Save,
  X,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  addChecklistItem,
  addTaskAttachment,
  addTaskComment,
  createSubtask,
  deleteTaskAttachment,
  updateTask,
  updateTaskAttachment,
  type TaskRelatedFormState,
  type UpdateTaskFormState,
} from "@/app/(dashboard)/tasks/actions";
import { Avatar } from "@/components/avatar";
import { ChecklistItemCheckbox } from "@/components/checklist-item-checkbox";
import { TaskDoneCheckbox } from "@/components/task-done-checkbox";
import { ProjectBadge } from "@/components/project-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_TYPE_LABEL,
} from "@/lib/labels";
import type { Tables } from "@/lib/supabase/types";
import {
  TASK_PRIORITY_VALUES,
  TASK_STATUS_VALUES,
  TASK_TYPE_VALUES,
} from "@/lib/validation";

export type EditableTask = Tables<"tasks"> & {
  project: { id: string; name: string } | null;
  assignee: { id: string; full_name: string } | null;
};

type TaskComment = Tables<"task_comments"> & {
  author: { full_name: string } | null;
};

export type SubtaskRow = {
  id: string;
  title: string;
  status: Tables<"tasks">["status"];
  assignee: { id: string; full_name: string } | null;
};

type TaskEditorProps = {
  task: EditableTask;
  projects: { id: string; name: string }[];
  profiles: { id: string; full_name: string }[];
  checklist: Tables<"task_checklist_items">[];
  comments: TaskComment[];
  attachments: Tables<"task_attachments">[];
  subtasks: SubtaskRow[];
  workstreamOptions: string[];
  closeHref: string;
};

export function TaskEditor({
  task,
  projects,
  profiles,
  checklist,
  comments,
  attachments,
  subtasks,
  workstreamOptions,
  closeHref,
}: TaskEditorProps) {
  const formId = `task-editor-${task.id}`;
  const [state, formAction, pending] = useActionState<
    UpdateTaskFormState,
    FormData
  >(updateTask, undefined);
  const [description, setDescription] = useState(task.description ?? "");
  const descriptionLinks = extractLinks(description);

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col overflow-y-auto border-l border-neutral-200 bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-neutral-200 bg-white/95 px-5 py-3 backdrop-blur">
        <div className="min-w-0">
          <p className="text-xs font-medium text-neutral-500">
            Редактор задачи
          </p>
          <ProjectBadge
            projectId={task.project?.id}
            name={task.project?.name}
            className="mt-1 max-w-72"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="submit" form={formId} size="sm" disabled={pending}>
            <Save className="size-3.5" aria-hidden />
            {pending ? "Сохраняем..." : "Сохранить"}
          </Button>
          <Link
            href={closeHref}
            aria-label="Закрыть редактор"
            className="rounded-md p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="size-4" aria-hidden />
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-7 p-5">
        <form
          id={formId}
          action={formAction}
          className="flex flex-col gap-5"
        >
          <input type="hidden" name="id" value={task.id} />

          <div className="flex flex-col gap-1">
            <Label htmlFor={`${formId}-title`}>Название</Label>
            <Input
              id={`${formId}-title`}
              name="title"
              defaultValue={task.title}
              required
              className="h-auto min-h-11 px-3 py-2 text-lg font-semibold"
            />
            <FieldErrors errors={state?.errors?.title} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <EditorField label="Проект" htmlFor={`${formId}-project`}>
              <Select
                id={`${formId}-project`}
                name="project_id"
                defaultValue={task.project_id ?? ""}
                className="w-full"
              >
                <option value="">Личное / без проекта</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
              <FieldErrors errors={state?.errors?.project_id} />
            </EditorField>

            <EditorField label="Статус" htmlFor={`${formId}-status`}>
              <Select
                id={`${formId}-status`}
                name="status"
                defaultValue={task.status ?? "todo"}
                className="w-full"
              >
                {TASK_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {TASK_STATUS_LABEL[status]}
                  </option>
                ))}
              </Select>
              <FieldErrors errors={state?.errors?.status} />
            </EditorField>

            <EditorField label="Исполнитель" htmlFor={`${formId}-assignee`}>
              <Select
                id={`${formId}-assignee`}
                name="assignee_id"
                defaultValue={task.assignee_id ?? ""}
                className="w-full"
              >
                <option value="">Не назначен</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </option>
                ))}
              </Select>
              <FieldErrors errors={state?.errors?.assignee_id} />
            </EditorField>

            <EditorField label="Приоритет" htmlFor={`${formId}-priority`}>
              <Select
                id={`${formId}-priority`}
                name="priority"
                defaultValue={task.priority ?? "medium"}
                className="w-full"
              >
                {TASK_PRIORITY_VALUES.map((priority) => (
                  <option key={priority} value={priority}>
                    {TASK_PRIORITY_LABEL[priority]}
                  </option>
                ))}
              </Select>
              <FieldErrors errors={state?.errors?.priority} />
            </EditorField>

            <EditorField label="Тип" htmlFor={`${formId}-type`}>
              <Select
                id={`${formId}-type`}
                name="task_type"
                defaultValue={task.task_type ?? "other"}
                className="w-full"
              >
                {TASK_TYPE_VALUES.map((type) => (
                  <option key={type} value={type}>
                    {TASK_TYPE_LABEL[type]}
                  </option>
                ))}
              </Select>
              <FieldErrors errors={state?.errors?.task_type} />
            </EditorField>

            <EditorField label="Дедлайн" htmlFor={`${formId}-due`}>
              <Input
                id={`${formId}-due`}
                name="due_date"
                type="date"
                defaultValue={task.due_date ?? ""}
              />
              <FieldErrors errors={state?.errors?.due_date} />
            </EditorField>

            <EditorField label="Оценка, ч" htmlFor={`${formId}-estimate`}>
              <Input
                id={`${formId}-estimate`}
                name="estimate_hours"
                type="number"
                min="0"
                step="0.25"
                inputMode="decimal"
                defaultValue={
                  task.estimate_minutes === null
                    ? ""
                    : task.estimate_minutes / 60
                }
              />
              <FieldErrors errors={state?.errors?.estimate_minutes} />
            </EditorField>

            <EditorField label="Направление" htmlFor={`${formId}-workstream`}>
              <Input
                id={`${formId}-workstream`}
                name="workstream"
                list={`${formId}-workstream-options`}
                defaultValue={task.workstream ?? ""}
                placeholder="Напр. Сайт или Таргет"
              />
              <datalist id={`${formId}-workstream-options`}>
                {workstreamOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              <FieldErrors errors={state?.errors?.workstream} />
            </EditorField>
          </div>

          <div className="flex flex-wrap gap-5 rounded-md bg-neutral-50 px-3 py-2.5">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <Checkbox
                name="is_important"
                defaultChecked={task.is_important ?? false}
              />
              Важно
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <Checkbox
                name="is_urgent"
                defaultChecked={task.is_urgent ?? false}
              />
              Срочно
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor={`${formId}-description`}>
              Описание и дополнительная информация
            </Label>
            <Textarea
              id={`${formId}-description`}
              name="description"
              rows={8}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Напишите ТЗ, детали, договорённости и вставьте нужные ссылки…"
            />
            <p className="text-xs text-neutral-400">
              Ссылки можно вставлять прямо в описание — после сохранения они
              останутся здесь.
            </p>
            <FieldErrors errors={state?.errors?.description} />
            {descriptionLinks.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {descriptionLinks.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{url}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          <FieldErrors errors={state?.errors?._root} />
          <p
            aria-live="polite"
            className={state?.success ? "text-sm text-emerald-700" : "sr-only"}
          >
            {state?.success ? "Изменения сохранены" : ""}
          </p>

          <Button type="submit" disabled={pending} className="self-start">
            <Save className="size-4" aria-hidden />
            {pending ? "Сохраняем..." : "Сохранить изменения"}
          </Button>
        </form>

        <SubtasksSection
          taskId={task.id}
          subtasks={subtasks}
          profiles={profiles}
        />
        <ChecklistSection taskId={task.id} checklist={checklist} />
        <CommentsSection taskId={task.id} comments={comments} />
        <AttachmentsSection taskId={task.id} attachments={attachments} />
      </div>
    </aside>
  );
}

function SubtasksSection({
  taskId,
  subtasks,
  profiles,
}: {
  taskId: string;
  subtasks: SubtaskRow[];
  profiles: { id: string; full_name: string }[];
}) {
  const [state, formAction, pending] = useActionState<
    TaskRelatedFormState,
    FormData
  >(createSubtask, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useResetFormOnSuccess(formRef, state);

  return (
    <EditorSection icon={ListTree} title="Подзадачи">
      <ul className="flex flex-col gap-1.5">
        {subtasks.length === 0 && (
          <li className="text-sm text-neutral-400">Подзадач пока нет</li>
        )}
        {subtasks.map((subtask) => (
          <li
            key={subtask.id}
            className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-sm"
          >
            <TaskDoneCheckbox
              taskId={subtask.id}
              done={subtask.status === "done"}
            />
            <Link
              href={`/tasks?task=${subtask.id}`}
              className={
                subtask.status === "done"
                  ? "flex-1 truncate text-neutral-400 line-through hover:underline"
                  : "flex-1 truncate text-neutral-800 hover:underline"
              }
            >
              {subtask.title}
            </Link>
            {subtask.assignee && (
              <span className="flex shrink-0 items-center gap-1 text-xs text-neutral-500">
                <Avatar name={subtask.assignee.full_name} />
                {subtask.assignee.full_name.split(" ")[0]}
              </span>
            )}
          </li>
        ))}
      </ul>
      <form
        ref={formRef}
        action={formAction}
        className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_auto]"
      >
        <input type="hidden" name="parent_task_id" value={taskId} />
        <Input name="title" placeholder="Новая подзадача" />
        <Select name="assignee_id" defaultValue="" aria-label="Исполнитель подзадачи">
          <option value="">Исполнитель…</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.full_name}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Добавляем..." : "Добавить"}
        </Button>
        <div className="sm:col-span-3">
          <RelatedErrors state={state} />
        </div>
      </form>
    </EditorSection>
  );
}

function ChecklistSection({
  taskId,
  checklist,
}: {
  taskId: string;
  checklist: Tables<"task_checklist_items">[];
}) {
  const [state, formAction, pending] = useActionState<
    TaskRelatedFormState,
    FormData
  >(addChecklistItem, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useResetFormOnSuccess(formRef, state);

  return (
    <EditorSection icon={ListChecks} title="Чеклист">
      <ul className="flex flex-col gap-2">
        {checklist.length === 0 && (
          <li className="text-sm text-neutral-400">Пока пусто</li>
        )}
        {checklist.map((item) => (
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
      <form
        ref={formRef}
        action={formAction}
        className="mt-3 flex items-start gap-2"
      >
        <input type="hidden" name="task_id" value={taskId} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Input name="title" placeholder="Новый пункт чеклиста" />
          <RelatedErrors state={state} />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Добавляем..." : "Добавить"}
        </Button>
      </form>
    </EditorSection>
  );
}

function CommentsSection({
  taskId,
  comments,
}: {
  taskId: string;
  comments: TaskComment[];
}) {
  const [state, formAction, pending] = useActionState<
    TaskRelatedFormState,
    FormData
  >(addTaskComment, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useResetFormOnSuccess(formRef, state);

  return (
    <EditorSection icon={MessageSquare} title="Комментарии">
      <ul className="flex flex-col gap-2">
        {comments.length === 0 && (
          <li className="text-sm text-neutral-400">Комментариев нет</li>
        )}
        {comments.map((comment) => (
          <li
            key={comment.id}
            className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
              <span className="flex items-center gap-2 font-medium text-neutral-700">
                <Avatar name={comment.author?.full_name} />
                {comment.author?.full_name ?? "—"}
              </span>
              <span>{formatDate(comment.created_at)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-neutral-800">
              {comment.body}
            </p>
          </li>
        ))}
      </ul>
      <form ref={formRef} action={formAction} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="task_id" value={taskId} />
        <Textarea name="body" rows={3} placeholder="Добавить комментарий…" />
        <RelatedErrors state={state} />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Отправляем..." : "Добавить комментарий"}
        </Button>
      </form>
    </EditorSection>
  );
}

function AttachmentsSection({
  taskId,
  attachments,
}: {
  taskId: string;
  attachments: Tables<"task_attachments">[];
}) {
  return (
    <EditorSection icon={Paperclip} title="Ссылки и вложения">
      <div className="flex flex-col gap-3">
        {attachments.length === 0 && (
          <p className="text-sm text-neutral-400">Вложений пока нет</p>
        )}
        {attachments.map((attachment) => (
          <AttachmentEditor
            key={attachment.id}
            taskId={taskId}
            attachment={attachment}
          />
        ))}
      </div>
      <AddAttachmentForm taskId={taskId} />
    </EditorSection>
  );
}

function AttachmentEditor({
  taskId,
  attachment,
}: {
  taskId: string;
  attachment: Tables<"task_attachments">;
}) {
  const [state, formAction, pending] = useActionState<
    TaskRelatedFormState,
    FormData
  >(updateTaskAttachment, undefined);
  const deleteAction = deleteTaskAttachment.bind(
    null,
    attachment.id,
    taskId,
  );

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="mb-2 inline-flex max-w-full items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
      >
        <ExternalLink className="size-3 shrink-0" aria-hidden />
        <span className="truncate">
          {attachment.title ?? attachment.url}
        </span>
      </a>
      <form action={formAction} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <input type="hidden" name="task_id" value={taskId} />
        <input type="hidden" name="attachment_id" value={attachment.id} />
        <Input
          name="title"
          defaultValue={attachment.title ?? ""}
          placeholder="Название"
          aria-label="Название вложения"
        />
        <Input
          name="url"
          type="url"
          defaultValue={attachment.url}
          placeholder="https://…"
          aria-label="Ссылка вложения"
          required
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "…" : "Сохранить"}
        </Button>
        <div className="sm:col-span-3">
          <RelatedErrors state={state} />
        </div>
      </form>
      <form
        action={deleteAction}
        className="mt-1"
        onSubmit={(event) => {
          if (!window.confirm("Удалить эту ссылку из задачи?")) {
            event.preventDefault();
          }
        }}
      >
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          Удалить
        </Button>
      </form>
    </div>
  );
}

function AddAttachmentForm({ taskId }: { taskId: string }) {
  const [state, formAction, pending] = useActionState<
    TaskRelatedFormState,
    FormData
  >(addTaskAttachment, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useResetFormOnSuccess(formRef, state);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-3 rounded-md border border-dashed border-neutral-300 p-3"
    >
      <input type="hidden" name="task_id" value={taskId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input name="title" placeholder="Название ссылки (необязательно)" />
        <Input
          name="url"
          type="url"
          placeholder="https://…"
          required
        />
      </div>
      <RelatedErrors state={state} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        className="mt-2"
      >
        <Link2 className="size-3.5" aria-hidden />
        {pending ? "Добавляем..." : "Добавить ссылку"}
      </Button>
    </form>
  );
}

function EditorSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ListChecks;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-neutral-200 pt-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
        <Icon className="size-4 text-neutral-500" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

function EditorField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function FieldErrors({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <>
      {errors.map((error) => (
        <p key={error} className="text-xs text-red-600">
          {error}
        </p>
      ))}
    </>
  );
}

function RelatedErrors({ state }: { state: TaskRelatedFormState }) {
  if (!state?.errors?.length) return null;
  return <FieldErrors errors={state.errors} />;
}

function useResetFormOnSuccess(
  formRef: React.RefObject<HTMLFormElement | null>,
  state: TaskRelatedFormState,
) {
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [formRef, state]);
}

function extractLinks(value: string): string[] {
  const matches = value.match(/https?:\/\/[^\s<>"']+/g) ?? [];
  return [...new Set(matches)];
}
