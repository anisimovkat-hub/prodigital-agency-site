import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { TimerBar } from "@/components/timer-bar";

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

  const [{ data: activeEntry }, { data: timerProjects }] = await Promise.all([
    supabase
      .from("time_entries")
      .select("id,project_id,started_at, project:projects(id,name)")
      .is("ended_at", null)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id,name")
      .eq("stage", "active")
      .order("name"),
  ]);

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-x-auto p-4 sm:p-6 md:p-8">
        <div className="mb-4">
          <TimerBar
            active={activeEntry ?? null}
            projects={timerProjects ?? []}
          />
        </div>
        {children}
      </main>
    </div>
  );
}
