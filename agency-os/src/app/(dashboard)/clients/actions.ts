"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createClientSchema,
  flattenZodErrors,
  updateClientStatusSchema,
} from "@/lib/validation";
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

export type ClientStatusFormState =
  | { error: string; success?: false }
  | {
      error?: undefined;
      success: true;
      client: Pick<Tables<"clients">, "id" | "status">;
    }
  | undefined;

export async function updateClientStatus(
  _prevState: ClientStatusFormState,
  formData: FormData,
): Promise<ClientStatusFormState> {
  const parsed = updateClientStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректный статус" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Нет авторизации. Войдите снова." };

  const { data: client, error } = await supabase
    .from("clients")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("id,status")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!client) return { error: "Клиент не изменён: проверьте права доступа" };

  revalidatePath("/clients");
  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/");

  return { success: true, client };
}

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

  const { data: client, error } = await supabase.from("clients").insert({
    name: parsed.data.name,
    status: parsed.data.status,
    budget: parsed.data.budget ?? null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    telegram: parsed.data.telegram || null,
    notes: parsed.data.notes || null,
  }).select("id").maybeSingle();

  if (error || !client) {
    return { errors: { name: [error?.message ?? "Не удалось создать клиента"] } };
  }

  revalidatePath("/clients");
  revalidatePath("/");

  redirect(`/clients/${client.id}?new=1`);
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
