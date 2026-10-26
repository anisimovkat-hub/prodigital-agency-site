"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type EmployeeFormState = { error: string } | { employee: { id: string; name: string } } | undefined;

export async function createEmployee(_prevState: EmployeeFormState, formData: FormData): Promise<EmployeeFormState> {
  const fullName = String(formData.get("full_name") ?? "").trim().replace(/\s+/g, " ");
  const position = String(formData.get("position_title") ?? "").trim();
  if (!fullName || fullName.length > 100 || position.length > 150)
    return { error: "Укажите имя до 100 символов и должность до 150 символов." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Войдите в систему." };
  const { data: owner, error: ownerError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (ownerError || owner?.role !== "owner") return { error: "Добавлять сотрудников может только владелец." };
  const { data: existing, error: lookupError } = await supabase.from("profiles").select("id,full_name");
  if (lookupError) return { error: "Не удалось проверить список сотрудников. Попробуйте ещё раз." };
  if (existing?.some(p => p.full_name.trim().toLocaleLowerCase("ru") === fullName.toLocaleLowerCase("ru")))
    return { error: "Сотрудник с таким именем уже есть. Откройте его карточку или уточните имя." };

  const { data, error } = await supabase.from("profiles").insert({
    full_name: fullName, position_title: position || null, role: "specialist", is_manual: true,
    auth_user_id: null, is_active: true,
  }).select("id,full_name").maybeSingle();
  if (error || !data) return { error: error?.code === "23505" ? "Сотрудник с таким именем уже добавлен." : "Не удалось добавить сотрудника. Попробуйте ещё раз." };
  for (const path of ["/employees", "/tasks", "/projects", "/board", "/recurring", "/"]) revalidatePath(path);
  return { employee: { id: data.id, name: data.full_name } };
}

export type InviteFormState =
  | { error: string }
  | { code: string }
  | undefined;

export async function createInvite(
  _prevState: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const role = String(formData.get("role") || "specialist");
  const fullName = String(formData.get("full_name") || "").trim();

  if (!["specialist", "pm", "viewer"].includes(role)) {
    return { error: "Недопустимая роль" };
  }

  const code = randomBytes(4).toString("hex"); // 8 символов

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("invite_codes").insert({
    code,
    role: role as never,
    full_name: fullName || null,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/employees");
  return { code };
}
