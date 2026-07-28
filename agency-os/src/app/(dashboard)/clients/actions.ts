"use server";

import { revalidatePath } from "next/cache";

import { createClientSchema, flattenZodErrors } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type CreateClientFormState =
  | { errors: Record<string, string[]> }
  | undefined;

export type SavedClientFormValues = Pick<
  Tables<"clients">,
  | "id"
  | "name"
  | "status"
  | "budget"
  | "phone"
  | "email"
  | "telegram"
  | "notes"
>;

export type ClientEditFormState =
  | { errors: Record<string, string[]>; success?: false }
  | {
      errors?: undefined;
      success: true;
      client: SavedClientFormValues;
    }
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
  _prevState: ClientEditFormState,
  formData: FormData,
): Promise<ClientEditFormState> {
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

  const { data: updatedClient, error } = await supabase
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
    .eq("id", id)
    .select("id,name,status,budget,phone,email,telegram,notes")
    .maybeSingle();

  if (error) {
    return { errors: { name: [error.message] } };
  }
  if (!updatedClient) {
    return {
      errors: {
        name: ["Клиент не изменён: проверьте права доступа"],
      },
    };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/");

  return { success: true, client: updatedClient };
}
