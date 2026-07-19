"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

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
