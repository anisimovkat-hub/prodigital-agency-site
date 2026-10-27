import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isVercelPreview } from "@/lib/preview-policy";
import { JarvisPreview } from "./preview-form";

export const dynamic = "force-dynamic";

export default async function JarvisPreviewPage() {
  if (!isVercelPreview()) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actor?.role !== "owner") notFound();
  const results = await Promise.all([
    supabase.from("projects").select("id,name,aliases,stage,responsible_id,client:clients(name)").order("name").limit(500),
    supabase.from("profiles").select("id,full_name,aliases").eq("is_active", true).order("full_name").limit(100),
    supabase.from("project_members").select("project_id,profile_id").limit(2000),
    supabase.from("project_responsibles").select("project_id,profile_id").limit(2000),
  ]);
  for (const result of results) if (result.error) throw new Error("Не удалось прочитать справочник для проверки.");
  const [projects, profiles, members, responsibles] = results;
  return <JarvisPreview catalog={{
    projects: (projects.data ?? []).map((p) => ({ id: p.id, name: p.name, aliases: p.aliases, stage: p.stage,
      clientName: p.client?.name,
      memberIds: [...new Set([p.responsible_id, ...(members.data ?? []).filter((m) => m.project_id === p.id).map((m) => m.profile_id), ...(responsibles.data ?? []).filter((m) => m.project_id === p.id).map((m) => m.profile_id)].filter((id): id is string => Boolean(id)))],
    })),
    profiles: (profiles.data ?? []).map((p) => ({ id: p.id, name: p.full_name, aliases: p.aliases })),
  }} />;
}
