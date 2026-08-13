"use server";

import { revalidatePath } from "next/cache";

import {
  extractGoogleSpreadsheetId,
  parseMediaPlanImportRows,
  type MediaPlanImportRow,
} from "@/lib/media-plan-import";
import { fetchGoogleSheetValues } from "@/lib/google-sheets";
import { createClient } from "@/lib/supabase/server";
import { flattenZodErrors, mediaPlanSchema } from "@/lib/validation";

export type MediaPlanActionState =
  | {
      ok: boolean;
      message: string;
      errors?: Record<string, string[]>;
      preview?: MediaPlanImportRow[];
    }
  | undefined;

const MANUAL_METRICS = [
  ["spend", "Рекламный бюджет", "money"],
  ["impressions", "Показы", "count"],
  ["clicks", "Клики", "count"],
  ["reach", "Охват", "count"],
  ["conversion", "Основные результаты", "count"],
  ["revenue", "Выручка", "money"],
] as const;

type MetricInsert = {
  metric_key: string;
  label: string;
  target_value: number;
  unit: "money" | "count";
  conversion_action_type: string | null;
  campaign_id: string | null;
  sort_order: number;
  notes: string | null;
};

export async function saveManualMediaPlan(
  _state: MediaPlanActionState,
  formData: FormData,
): Promise<MediaPlanActionState> {
  const parsed = mediaPlanSchema.safeParse({
    project_id: formData.get("project_id"),
    workstream: formData.get("workstream"),
    period_start: formData.get("period_start"),
    period_end: formData.get("period_end"),
    name: formData.get("name"),
    status: formData.get("status"),
    currency: formData.get("currency"),
    source_type: "manual",
  });
  if (!parsed.success) {
    return { ok: false, message: "Проверьте поля медиаплана", errors: flattenZodErrors(parsed.error) };
  }

  const conversionActionType = String(formData.get("conversion_action_type") ?? "").trim();
  const metrics: MetricInsert[] = [];
  for (const [index, [key, label, unit]] of MANUAL_METRICS.entries()) {
    const raw = String(formData.get(`metric_${key}`) ?? "").trim().replace(/\s/g, "").replace(",", ".");
    if (!raw) continue;
    const targetValue = Number(raw);
    if (!Number.isFinite(targetValue) || targetValue < 0) {
      return { ok: false, message: `${label}: укажите неотрицательное число` };
    }
    if (key === "conversion" && !conversionActionType) {
      return { ok: false, message: "Для результата укажите точный action_type из Meta" };
    }
    metrics.push({
      metric_key: key === "conversion" ? `conversion:${conversionActionType}` : key,
      label,
      target_value: targetValue,
      unit,
      conversion_action_type: key === "conversion" ? conversionActionType : null,
      campaign_id: nullableString(formData.get(`campaign_${key}`)),
      sort_order: index,
      notes: nullableString(formData.get(`notes_${key}`)),
    });
  }
  if (!metrics.length) return { ok: false, message: "Добавьте хотя бы одну плановую метрику" };

  try {
    const { supabase, userId } = await requireOwner();
    const { data: plan, error: planError } = await supabase
      .from("media_plans")
      .insert({
        project_id: parsed.data.project_id,
        workstream: parsed.data.workstream ?? null,
        period_start: parsed.data.period_start,
        period_end: parsed.data.period_end,
        name: parsed.data.name,
        status: parsed.data.status,
        currency: parsed.data.currency,
        source_type: "manual",
        created_by: userId,
      })
      .select("id")
      .single();
    if (planError || !plan) throw new Error(planError?.message ?? "Медиаплан не создан");
    const { error: metricsError } = await supabase.from("media_plan_metrics").insert(
      metrics.map((row) => ({ ...row, media_plan_id: plan.id })),
    );
    if (metricsError) {
      await supabase.from("media_plans").delete().eq("id", plan.id);
      throw new Error(metricsError.message);
    }
    revalidateAnalytics(parsed.data.project_id);
    return { ok: true, message: "Медиаплан сохранён" };
  } catch (error) {
    return { ok: false, message: friendlyError(error) };
  }
}

export async function previewGoogleSheetMediaPlan(
  _state: MediaPlanActionState,
  formData: FormData,
): Promise<MediaPlanActionState> {
  const sourceUrl = String(formData.get("source_url") ?? "");
  const sourceRange = String(formData.get("source_range") ?? "Agency OS!A1:G100").trim();
  const spreadsheetId = extractGoogleSpreadsheetId(sourceUrl);
  if (!spreadsheetId) return { ok: false, message: "Вставьте корректную HTTPS-ссылку Google Sheets" };
  if (!sourceRange) return { ok: false, message: "Укажите диапазон листа" };

  try {
    await requireOwner();
    const values = await fetchGoogleSheetValues(spreadsheetId, sourceRange);
    const parsed = parseMediaPlanImportRows(values);
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.errors.slice(0, 5).map((error) => `Строка ${error.row}: ${error.message}`).join(" · "),
      };
    }
    return { ok: true, message: `Проверено строк: ${parsed.rows.length}`, preview: parsed.rows };
  } catch (error) {
    return { ok: false, message: friendlyError(error) };
  }
}

export async function importGoogleSheetMediaPlan(
  _state: MediaPlanActionState,
  formData: FormData,
): Promise<MediaPlanActionState> {
  const parsedPlan = mediaPlanSchema.safeParse({
    project_id: formData.get("project_id"),
    workstream: formData.get("workstream"),
    period_start: formData.get("period_start"),
    period_end: formData.get("period_end"),
    name: formData.get("name"),
    status: "draft",
    currency: formData.get("currency"),
    source_type: "google_sheets",
    source_url: formData.get("source_url"),
    source_range: formData.get("source_range"),
  });
  if (!parsedPlan.success) {
    return { ok: false, message: "Проверьте поля импорта", errors: flattenZodErrors(parsedPlan.error) };
  }
  const spreadsheetId = extractGoogleSpreadsheetId(parsedPlan.data.source_url ?? "");
  if (!spreadsheetId) return { ok: false, message: "Некорректная ссылка Google Sheets" };

  try {
    const { supabase, userId } = await requireOwner();
    const rowsResult = parseMediaPlanImportRows(
      await fetchGoogleSheetValues(spreadsheetId, parsedPlan.data.source_range ?? ""),
    );
    if (!rowsResult.success) {
      return { ok: false, message: rowsResult.errors.slice(0, 5).map((error) => `Строка ${error.row}: ${error.message}`).join(" · ") };
    }

    const campaignExternalIds = [...new Set(rowsResult.rows.flatMap((row) => row.campaignExternalId ? [row.campaignExternalId] : []))];
    const { data: campaigns, error: campaignError } = campaignExternalIds.length
      ? await supabase
          .from("ad_campaigns")
          .select("id,external_id,project_id,ad_account:ad_accounts!inner(project_id,currency)")
          .in("external_id", campaignExternalIds)
      : { data: [], error: null };
    if (campaignError) throw new Error(campaignError.message);
    const campaignMap = new Map(
      (campaigns ?? []).flatMap((campaign) => {
        const account = Array.isArray(campaign.ad_account) ? campaign.ad_account[0] : campaign.ad_account;
        const projectId = campaign.project_id ?? account?.project_id ?? null;
        return projectId === parsedPlan.data.project_id && account?.currency === parsedPlan.data.currency
          ? [[campaign.external_id, campaign.id] as const]
          : [];
      }),
    );
    const missing = campaignExternalIds.filter((id) => !campaignMap.has(id));
    if (missing.length) {
      return { ok: false, message: `Кампании не найдены в выбранном проекте и валюте: ${missing.join(", ")}` };
    }

    const { data: plan, error: planError } = await supabase
      .from("media_plans")
      .insert({
        project_id: parsedPlan.data.project_id,
        workstream: parsedPlan.data.workstream ?? null,
        period_start: parsedPlan.data.period_start,
        period_end: parsedPlan.data.period_end,
        name: parsedPlan.data.name,
        // Каждый импорт — новая черновая версия. Утверждение всегда отдельным действием.
        status: "draft",
        currency: parsedPlan.data.currency,
        source_type: "google_sheets",
        source_spreadsheet_id: spreadsheetId,
        source_range: parsedPlan.data.source_range,
        source_url: parsedPlan.data.source_url,
        imported_at: new Date().toISOString(),
        created_by: userId,
      })
      .select("id")
      .single();
    if (planError || !plan) throw new Error(planError?.message ?? "Медиаплан не создан");
    const { error: metricsError } = await supabase.from("media_plan_metrics").insert(
      rowsResult.rows.map((row, index) => ({
        media_plan_id: plan.id,
        metric_key: row.metricKey,
        label: row.label,
        target_value: row.targetValue,
        unit: row.unit,
        conversion_action_type: row.conversionActionType,
        campaign_id: row.campaignExternalId ? campaignMap.get(row.campaignExternalId) ?? null : null,
        sort_order: index,
        notes: row.notes,
      })),
    );
    if (metricsError) {
      await supabase.from("media_plans").delete().eq("id", plan.id);
      throw new Error(metricsError.message);
    }
    revalidateAnalytics(parsedPlan.data.project_id);
    return { ok: true, message: `Импортировано метрик: ${rowsResult.rows.length}` };
  } catch (error) {
    return { ok: false, message: friendlyError(error) };
  }
}

export async function changeMediaPlanStatus(
  _state: MediaPlanActionState,
  formData: FormData,
): Promise<MediaPlanActionState> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["draft", "approved", "archived"].includes(status)) {
    return { ok: false, message: "Некорректный статус медиаплана" };
  }
  try {
    const { supabase } = await requireOwner();
    const { data, error } = await supabase.from("media_plans").update({ status }).eq("id", id).select("project_id").maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Медиаплан не найден");
    revalidateAnalytics(data.project_id);
    return { ok: true, message: "Статус медиаплана изменён" };
  } catch (error) {
    return { ok: false, message: friendlyError(error) };
  }
}

async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нет авторизации. Войдите снова.");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "owner") throw new Error("Недостаточно прав.");
  return { supabase, userId: user.id };
}

function revalidateAnalytics(projectId: string) {
  revalidatePath("/analytics");
  revalidatePath(`/projects/${projectId}`);
}

function nullableString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Неизвестная ошибка";
  if (message.includes("media_plans_one_approved_scope_idx")) {
    return "Для этого проекта, направления, периода и валюты уже есть утверждённый план";
  }
  return message;
}
