import Link from "next/link";

import {
  TaskEditor,
  type EditableTask,
  type SubtaskRow,
} from "@/app/(dashboard)/tasks/task-editor";
import { createClient } from "@/lib/supabase/server";
import { sumRawTaskTime } from "@/lib/time-analytics";

export async function TaskDrawer({
  taskId,
  closeHref,
}: {
  taskId: string;
  closeHref: string;
}) {
  const supabase = await createClient();
  const timeSnapshotAt = new Date();

  const [
    { data: task },
    { data: checklist },
    { data: comments },
    { data: attachments },
    { data: subtasks },
    { data: projects },
    { data: profiles },
    { data: workstreamRows },
    { data: timeEntries },
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
      supabase
        .from("tasks")
        .select(
          "id,title,status,assignee:profiles!tasks_assignee_id_fkey(id,full_name)",
        )
        .eq("parent_task_id", taskId)
        .order("created_at"),
      supabase.from("projects").select("id,name").order("name"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
      supabase.from("tasks").select("workstream").not("workstream", "is", null),
      supabase
        .from("task_time_entries")
        .select("task_id,started_at,ended_at")
        .eq("task_id", taskId),
    ]);

  if (!task) return null;

  const workstreamOptions = [
    ...new Set(
      (workstreamRows ?? [])
        .map((row) => row.workstream)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const trackedSeconds =
    sumRawTaskTime(timeEntries ?? [], timeSnapshotAt).get(task.id) ?? 0;

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
        subtasks={(subtasks ?? []) as SubtaskRow[]}
        workstreamOptions={workstreamOptions}
        closeHref={closeHref}
        trackedSeconds={Math.round(trackedSeconds)}
        trackingActive={task.status === "in_progress"}
        timeSnapshotAt={timeSnapshotAt.toISOString()}
      />
    </>
  );
}
