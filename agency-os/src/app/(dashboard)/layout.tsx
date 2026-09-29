import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

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

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();
  const mobileEnabled = profile?.role === "owner";

  return (
    <div className={`flex min-h-dvh min-w-0 flex-1 flex-col md:flex-row ${mobileEnabled ? "owner-mobile" : ""}`}>
      <Sidebar mobileEnabled={mobileEnabled} />
      <main className="dashboard-main min-w-0 flex-1 p-4 sm:p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
