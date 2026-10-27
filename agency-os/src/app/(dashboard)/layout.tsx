import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { dateISOInTimeZone } from "@/lib/calendar-events";
import { isTaskOperational } from "@/lib/project-lifecycle";
import { isActiveTaskStatus } from "@/lib/task-status";

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

  const today = dateISOInTimeZone(new Date());
  const [{ data: profile }, { data: overdueRows }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    // Счётчик в меню: только мои просроченные задачи в действующих проектах.
    supabase
      .from("tasks")
      .select("project_id,status,project:projects(stage)")
      .eq("assignee_id", user.id)
      .lt("due_date", today)
      .limit(500),
  ]);
  const overdueCount = (overdueRows ?? []).filter(
    (task) => isActiveTaskStatus(task.status) && isTaskOperational(task),
  ).length;
  const mobileEnabled = profile?.role === "owner";

  return (
    <div className={`flex min-h-dvh min-w-0 flex-1 flex-col md:flex-row ${mobileEnabled ? "owner-mobile" : ""}`}>
      <Sidebar mobileEnabled={mobileEnabled} overdueCount={overdueCount} />
      <main className="dashboard-main min-w-0 flex-1 p-4 sm:p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
