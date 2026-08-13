import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { FocusBar } from "@/components/focus-bar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: activeFocus }, { data: focusTasks }] = await Promise.all([
    supabase
      .from("focus_sessions")
      .select("id,started_at,task:tasks(id,title,project:projects(id,name))")
      .eq("user_id", user.id)
      .is("ended_at", null)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("id,title,project:projects(id,name,stage)")
      .or(`assignee_id.eq.${user.id},and(assignee_id.is.null,creator_id.eq.${user.id})`)
      .neq("status", "done")
      .neq("status", "cancelled")
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-x-auto p-4 sm:p-6 md:p-8">
        <div className="mb-4">
          <FocusBar
            active={activeFocus ?? null}
            tasks={(focusTasks ?? []).filter(
              (task) =>
                !task.project ||
                task.project.stage === "active" ||
                task.project.stage === "launching",
            )}
          />
        </div>
        {children}
      </main>
    </div>
  );
}
