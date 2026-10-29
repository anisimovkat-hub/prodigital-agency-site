import "server-only";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TelegramAdminError } from "@/lib/telegram-bot-admin";

// Same getUser + profiles.role pattern as the existing owner Server Actions.
// It must run inside every action as well as in the page; hiding a button is
// never authorization. No service client or database mutation is needed.
export async function requireTelegramBotOwner() {
  if (process.env.VERCEL_ENV !== "production") throw new TelegramAdminError("production_only");
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new TelegramAdminError("owner_only");
  const { data: actor, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error || actor?.role !== "owner") throw new TelegramAdminError("owner_only");
}

export async function requireTelegramActionOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  // Next checks same-origin too. Also reject missing Origin here (Next otherwise
  // warns and permits it), with no expansion of serverActions.allowedOrigins.
  if (!origin || !host || origin !== `https://${host}`) throw new TelegramAdminError("same_origin_required");
}
