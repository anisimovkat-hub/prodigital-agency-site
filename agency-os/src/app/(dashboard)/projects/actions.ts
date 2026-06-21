"use server";

import { revalidatePath } from "next/cache";

import { flattenZodErrors, kpiEntrySchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

export type KpiFormState =
  | { errors: Record<string, string[]> }
  | undefined;

export async function addKpiEntry(
  projectId: string,
  _prevState: KpiFormState,
  formData: FormData,
): Promise<KpiFormState> {
  const parsed = kpiEntrySchema.safeParse({
    entry_date: formData.get("entry_date"),
    spend: formData.get("spend"),
    impressions: formData.get("impressions"),
    clicks: formData.get("clicks"),
    leads: formData.get("leads"),
    sales: formData.get("sales"),
    revenue: formData.get("revenue"),
    comment: formData.get("comment"),
  });

  if (!parsed.success) {
    return { errors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("kpi_entries").insert({
    project_id: projectId,
    entry_date: parsed.data.entry_date,
    spend: parsed.data.spend ?? 0,
    impressions: parsed.data.impressions ?? 0,
    clicks: parsed.data.clicks ?? 0,
    leads: parsed.data.leads ?? 0,
    sales: parsed.data.sales ?? 0,
    revenue: parsed.data.revenue ?? 0,
    comment: parsed.data.comment || null,
  });

  if (error) {
    return { errors: { entry_date: [error.message] } };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");

  return undefined;
}
