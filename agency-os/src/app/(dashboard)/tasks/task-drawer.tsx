import Link from "next/link";

import {
  TaskEditor,
  type EditableTask,
  type SubtaskRow,
} from "@/app/(dashboard)/tasks/task-editor";
import { createClient } from "@/lib/supabase/server";
import { sortProjectsForDisplay } from "@/lib/project-order";
import { sumRawTaskTime } from "@/lib/time-analytics";

export async function TaskDrawer({
  taskId,
  closeHref,
}: {
  taskId: string;
  closeHref: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    { data: activeFocus },
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
      supabase.from("projects").select("id,name,stage"),
      supabase.from("profiles").select("id,full_name").order("full_name"),
      supabase.from("tasks").select("workstream").not("workstream", "is", null),
      supabase
        .from("task_time_entries")
        .select("task_id,started_at,ended_at")
        .eq("task_id", taskId),
      user
        ? supabase
            .from("focus_sessions")
            .select("task_id")
            .eq("user_id", user.id)
            .is("ended_at", null)
            .maybeSingle()
        : Promise.resolve({ data: null }),
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
        projects={sortProjectsForDisplay(projects ?? [])}
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
        focusActive={activeFocus?.task_id === task.id}
        focusAllowed={
          Boolean(user) &&
          (task.assignee_id === user?.id ||
            (!task.assignee_id && task.creator_id === user?.id)) &&
          task.status !== "done" &&
          task.status !== "cancelled"
        }
      />
    </>
  );
}
