import Link from "next/link";

import {
  TaskEditor,
  type EditableTask,
} from "@/app/(dashboard)/tasks/task-editor";
import { createClient } from "@/lib/supabase/server";

export async function TaskDrawer({
  taskId,
  closeHref,
}: {
  taskId: string;
  closeHref: string;
}) {
  const supabase = await createClient();

  const [
    { data: task },
    { data: checklist },
    { data: comments },
    { data: attachments },
    { data: projects },
    { data: profiles },
  ] = await Promise.all([
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
      supabase.from("projects").select("id,name").order("name"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
    ]);

  if (!task) return null;

  return (
    <>
      <Link
        href={closeHref}
        aria-label="Закрыть"
        className="fixed inset-0 z-40 bg-neutral-900/30"
      />
      <TaskEditor
        key={task.id}
        task={task as EditableTask}
        projects={projects ?? []}
        profiles={profiles ?? []}
        checklist={checklist ?? []}
        comments={comments ?? []}
        attachments={attachments ?? []}
        closeHref={closeHref}
      />
    </>
  );
}
