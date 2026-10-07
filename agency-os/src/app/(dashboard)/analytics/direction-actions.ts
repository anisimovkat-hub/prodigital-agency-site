"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseYandexGoals, yandexGoalKey } from "@/lib/yandex-goals";

export type DirectionState = { ok: boolean; message: string } | undefined;
const schema = z.object({
  id: z.uuid().optional(), project_id: z.uuid(), name: z.string().trim().min(1).max(100),
  counter_ids: z.array(z.string().regex(/^\d+$/)).max(20), websites: z.array(z.url()).max(20),
  campaign_ids: z.array(z.uuid()).max(500), primary_goal: z.string().regex(/^yandex:\d+$/).nullable(), is_active: z.boolean(),
});

/** Configuration only; no calls that modify the advertising account. */
export async function saveAdDirection(_state: DirectionState, form: FormData): Promise<DirectionState> {
  const parsed = schema.safeParse({
    id: form.get('id') || undefined, project_id: form.get('project_id'), name: form.get('name'),
    counter_ids: String(form.get('counter_ids') ?? '').split(/[\s,;]+/).filter(Boolean),
    websites: String(form.get('websites') ?? '').split(/\s+/).filter(Boolean),
    campaign_ids: form.getAll('campaign_id'), primary_goal: form.get('primary_goal') || null, is_active: form.get('is_active') === 'on',
  });
  if (!parsed.success) return { ok: false, message: 'Проверьте название, номера счётчиков и адреса сайтов (с https://).' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Войдите в аккаунт владельца.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'owner') return { ok: false, message: 'Направления настраивает владелец.' };
  const row = parsed.data;
  const [campaigns, accounts, directions] = await Promise.all([
    supabase.from('ad_campaigns').select('id,ad_account_id').eq('project_id', row.project_id),
    supabase.from('ad_accounts').select('id,platform,yandex_goals').eq('project_id', row.project_id),
    supabase.from('project_ad_directions').select('id,campaign_ids,name').eq('project_id', row.project_id),
  ]);
  const error = campaigns.error ?? accounts.error ?? directions.error;
  if (error) return { ok: false, message: `Настройки не загружены: ${error.message}` };
  const accountIds = new Set((accounts.data ?? []).filter((a) => a.platform === 'yandex_direct').map((a) => a.id));
  const ids = new Set((campaigns.data ?? []).filter((c) => accountIds.has(c.ad_account_id)).map((c) => c.id));
  if (row.campaign_ids.some((id) => !ids.has(id))) return { ok: false, message: 'Кампания не относится к Яндексу этого проекта.' };
  const duplicate = directions.data?.find((d) => d.id !== row.id && d.campaign_ids.some((id) => row.campaign_ids.includes(id)));
  if (duplicate) return { ok: false, message: `Кампания уже относится к направлению «${duplicate.name}». Расход нельзя учитывать дважды.` };
  const keys = new Set((accounts.data ?? []).flatMap((a) => parseYandexGoals(a.yandex_goals).map((g) => yandexGoalKey(g.id))));
  if (row.primary_goal && !keys.has(row.primary_goal as `yandex:${string}`)) return { ok: false, message: 'Цель не найдена в подключённых кабинетах проекта.' };
  const values = { ...row, counter_ids: [...new Set(row.counter_ids)], campaign_ids: [...new Set(row.campaign_ids)], updated_at: new Date().toISOString() };
  const result = row.id
    ? await supabase.from('project_ad_directions').update(values).eq('id', row.id).eq('project_id', row.project_id).select('id').maybeSingle()
    : await supabase.from('project_ad_directions').insert(values).select('id').single();
  if (result.error || !result.data) return { ok: false, message: `Не удалось сохранить: ${result.error?.message ?? 'нет доступа'}` };
  revalidatePath('/analytics');
  return { ok: true, message: 'Направление сохранено. Выберите его над отчётом.' };
}
