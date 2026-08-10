"use server";

import { revalidatePath } from "next/cache";

import {
  createProjectSchema,
  flattenZodErrors,
  kpiEntrySchema,
  updateProjectQuickFieldSchema,
} from "@/lib/validation";
import { clientStatusFromProjectStages } from "@/lib/project-lifecycle";
import { createClient } from "@/lib/supabase/server";

export type CreateProjectFormState =
  | { errors: Record<string, string[]>; success?: false }
  | {
      errors?: undefined;
      success: true;
      project?: SavedProjectFormValues;
    }
  | undefined;

export type SavedProjectFormValues = {
  id: string;
  name: string;
  client_id: string | null;
  health: "green" | "yellow" | "red" | null;
  stage: "active" | "paused" | "finished" | null;
  budget: number | null;
  monthly_fee: number | null;
  ownership_mode: string | null;
  responsible_id: string | null;
  short_comment: string | null;
  logo_url: string | null;
};

export type QuickProjectFieldFormState =
  | { error: string; success?: false }
  | { error?: undefined; success: true }
  | undefined;

async function syncClientStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
) {
  const { data: clientProjects } = await supabase
    .from("projects")
    .select("stage")
    .eq("client_id", clientId);
  const status = clientStatusFromProjectStages(
    (clientProjects ?? []).map((project) => project.stage),
  );
  await supabase.from("clients").update({ status }).eq("id", clientId);
}

export async function addProject(
  _prevState: CreateProjectFormState,
  formData: FormData,
): Promise<CreateProjectFormState> {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    client_id: formData.get("client_id"),
    health: formData.get("health"),
    stage: formData.get("stage"),
    budget: formData.get("budget"),
    monthly_fee: formData.get("monthly_fee"),
    ownership_mode: formData.get("ownership_mode"),
    responsible_id: formData.get("responsible_id"),
    short_comment: formData.get("short_comment"),
    logo_url: formData.get("logo_url"),
  });

  if (!parsed.success) {
    return { errors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("projects").insert({
    name: parsed.data.name,
    client_id: parsed.data.client_id,
    health: parsed.data.health,
    stage: parsed.data.stage,
    budget: parsed.data.budget ?? null,
    monthly_fee: parsed.data.monthly_fee ?? null,
    ownership_mode: parsed.data.ownership_mode ?? null,
    responsible_id: parsed.data.responsible_id || null,
    short_comment: parsed.data.short_comment || null,
    logo_url: parsed.data.logo_url || null,
  });

  if (error) {
    return { errors: { name: [error.message] } };
  }

  revalidatePath("/projects");
  revalidatePath("/");
  revalidatePath("/clients");

  return undefined;
}

export async function updateProject(
  _prevState: CreateProjectFormState,
  formData: FormData,
): Promise<CreateProjectFormState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { errors: { name: ["Некорректный проект"] } };
  }

  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    client_id: formData.get("client_id"),
    health: formData.get("health"),
    stage: formData.get("stage"),
    budget: formData.get("budget"),
    monthly_fee: formData.get("monthly_fee"),
    ownership_mode: formData.get("ownership_mode"),
    responsible_id: formData.get("responsible_id"),
    short_comment: formData.get("short_comment"),
    logo_url: formData.get("logo_url"),
  });

  if (!parsed.success) {
    return { errors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { errors: { _root: ["Нет авторизации. Войдите снова."] } };
  }

  const { data: previousProject } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", id)
    .maybeSingle();

  const { data: updatedProject, error } = await supabase
    .from("projects")
    .update({
      name: parsed.data.name,
      client_id: parsed.data.client_id,
      health: parsed.data.health,
      stage: parsed.data.stage,
      budget: parsed.data.budget ?? null,
      monthly_fee: parsed.data.monthly_fee ?? null,
      ownership_mode: parsed.data.ownership_mode ?? null,
      responsible_id: parsed.data.responsible_id || null,
      short_comment: parsed.data.short_comment || null,
      logo_url: parsed.data.logo_url || null,
    })
    .eq("id", id)
    .select(
      "id,name,client_id,health,stage,budget,monthly_fee,ownership_mode,responsible_id,short_comment,logo_url",
    )
    .maybeSingle();

  if (error) {
    return { errors: { name: [error.message] } };
  }
  if (!updatedProject) {
    return {
      errors: {
        _root: ["Проект не изменён: проверьте права доступа и повторите попытку"],
      },
    };
  }


  const clientIds = new Set(
    [previousProject?.client_id, updatedProject.client_id].filter(
      (clientId): clientId is string => Boolean(clientId),
    ),
  );
  for (const clientId of clientIds) {
    await syncClientStatus(supabase, clientId);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath("/clients");
  revalidatePath("/analytics");
  revalidatePath("/");

  return { success: true, project: updatedProject };
}

export async function updateProjectQuickField(
  _prevState: QuickProjectFieldFormState,
  formData: FormData,
): Promise<QuickProjectFieldFormState> {
  const parsed = updateProjectQuickFieldSchema.safeParse({
    id: formData.get("id"),
    field: formData.get("field"),
    value: formData.get("value"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректное значение" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Нет авторизации. Войдите снова." };
  }

  const updateResult =
    parsed.data.field === "health"
      ? await supabase
          .from("projects")
          .update({ health: parsed.data.value })
          .eq("id", parsed.data.id)
          .select("id,client_id")
          .maybeSingle()
      : await supabase
          .from("projects")
          .update({ stage: parsed.data.value })
          .eq("id", parsed.data.id)
          .select("id,client_id")
          .maybeSingle();

  if (updateResult.error) {
    return { error: updateResult.error.message };
  }
  if (!updateResult.data) {
    return { error: "Проект не изменён: проверьте права доступа" };
  }

  if (parsed.data.field === "stage" && updateResult.data.client_id) {
    await syncClientStatus(supabase, updateResult.data.client_id);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${parsed.data.id}`);
  revalidatePath("/clients");
  revalidatePath("/analytics");
  revalidatePath("/");

  return { success: true };
}

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
