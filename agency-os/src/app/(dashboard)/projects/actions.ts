"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function addKpiEntry(projectId: string, formData: FormData) {
  const entryDate = String(formData.get("entry_date") ?? "");
  if (!entryDate) return;

  const supabase = await createClient();

  await supabase.from("kpi_entries").insert({
    project_id: projectId,
    entry_date: entryDate,
    spend: Number(formData.get("spend") ?? 0),
    impressions: Number(formData.get("impressions") ?? 0),
    clicks: Number(formData.get("clicks") ?? 0),
    leads: Number(formData.get("leads") ?? 0),
    sales: Number(formData.get("sales") ?? 0),
    revenue: Number(formData.get("revenue") ?? 0),
    comment: (formData.get("comment") as string) || null,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}
