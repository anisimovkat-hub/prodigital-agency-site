"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { intakeAliasesSchema } from "@/lib/intake-aliases";

export type AliasFormState = { error?: string; success?: boolean } | undefined;

export async function saveIntakeAliases(_previous: AliasFormState, form: FormData): Promise<AliasFormState> {
  const parsed = intakeAliasesSchema.safeParse({ kind: form.get("kind"), id: form.get("id"), text: form.get("aliases") });
  if (!parsed.success) return { error: "Укажите до 40 названий, каждое не длиннее 80 знаков." };
  const service = await createClient();
  const { data: { user } } = await service.auth.getUser();
  if (!user) return { error: "Войдите в систему." };
  const { data: actor, error: actorError } = await service.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actorError || actor?.role !== "owner") return { error: "Менять названия может только владелец." };
  const { kind, id, text: aliases } = parsed.data;
  const { data, error } = await service.from(kind === "project" ? "projects" : "profiles").update({ aliases }).eq("id", id).select("id").maybeSingle();
  if (error || !data) return { error: "Названия не сохранены. Повторите попытку." };
  revalidatePath(kind === "project" ? `/projects/${id}` : `/employees/${id}`);
  revalidatePath("/projects"); revalidatePath("/employees"); revalidatePath("/clients");
  return { success: true };
}
