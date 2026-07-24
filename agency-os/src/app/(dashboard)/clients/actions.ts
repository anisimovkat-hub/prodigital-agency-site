"use server";

import { revalidatePath } from "next/cache";

import { createClientSchema, flattenZodErrors } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";

export type CreateClientFormState =
  | { errors: Record<string, string[]> }
  | undefined;

export async function addClient(
  _prevState: CreateClientFormState,
  formData: FormData,
): Promise<CreateClientFormState> {
  const parsed = createClientSchema.safeParse({
    name: formData.get("name"),
    status: formData.get("status"),
    budget: formData.get("budget"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    telegram: formData.get("telegram"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { errors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("clients").insert({
    name: parsed.data.name,
    status: parsed.data.status,
    budget: parsed.data.budget ?? null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    telegram: parsed.data.telegram || null,
    notes: parsed.data.notes || null,
  });

  if (error) {
    return { errors: { name: [error.message] } };
  }

  revalidatePath("/clients");
  revalidatePath("/");

  return undefined;
}

export async function updateClient(
  _prevState: CreateClientFormState,
  formData: FormData,
): Promise<CreateClientFormState> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { errors: { name: ["Некорректный клиент"] } };
  }

  const parsed = createClientSchema.safeParse({
    name: formData.get("name"),
    status: formData.get("status"),
    budget: formData.get("budget"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    telegram: formData.get("telegram"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { errors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("clients")
    .update({
      name: parsed.data.name,
      status: parsed.data.status,
      budget: parsed.data.budget ?? null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      telegram: parsed.data.telegram || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) {
    return { errors: { name: [error.message] } };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/");

  return undefined;
}
