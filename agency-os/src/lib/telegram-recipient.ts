import { createServiceClient } from "@/lib/supabase/service";

/**
 * Resolves a staff member to exactly one active Telegram work chat. A direct
 * profile binding wins; the title fallback supports chats connected before the
 * profile was unambiguously identified.
 */
export async function resolveTelegramRecipientChatId(
  profileId: string,
  fullName?: string | null,
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data: directBinding, error: bindingError } = await supabase
    .from("telegram_chat_bindings")
    .select("chat_id")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .maybeSingle();
  if (bindingError) throw bindingError;
  if (directBinding) return directBinding.chat_id;

  let name = fullName;
  if (!name) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", profileId)
      .maybeSingle();
    if (profileError) throw profileError;
    name = profile?.full_name;
  }
  const firstName = name?.trim().split(/\s+/)[0]?.toLocaleLowerCase("ru-RU");
  if (!firstName) return null;

  const { data: candidates, error: candidatesError } = await supabase
    .from("telegram_chat_bindings")
    .select("chat_id,chat_title")
    .eq("is_active", true);
  if (candidatesError) throw candidatesError;
  const matches = (candidates ?? []).filter((candidate) =>
    candidate.chat_title?.toLocaleLowerCase("ru-RU").includes(firstName),
  );
  return matches.length === 1 ? matches[0].chat_id : null;
}
