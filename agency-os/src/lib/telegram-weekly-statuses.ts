import "server-only";

import { previousWeekPeriod } from "@/lib/analytics-period";
import { sendTelegramMessage } from "@/lib/telegram";
import { createServiceClient } from "@/lib/supabase/service";

type Period = { from: string; to: string };
type Scenario = { id: string; project_id: string; name: string; channel: string; recipient_chat_id: string; report_url: string | null; template_key: string; fallback_source: unknown; is_active: boolean };
type Direction = { id: string; scenario_id: string; name: string; channel: string; counter_id: string; fallback_match: unknown; sort_order: number; is_active: boolean };
type Goal = { id: string; direction_id: string; goal_id: string; action_type: string; business_label: string; metric_kind: "cart" | "purchase" | "phone" | "messenger" | "form"; value_label: string | null; include_in_contact_cpa: boolean; sort_order: number; is_active: boolean };
type Campaign = { id: string; metrika_counter_ids: string[] };
type Metric = { campaign_id: string; date: string; spend: number; impressions: number; clicks: number; spend_includes_vat: boolean };
type Conversion = { campaign_id: string; date: string; action_type: string; count: number; value: number; is_measured: boolean; value_is_measured: boolean };

type GoalReport = { label: string; metricKind: Goal["metric_kind"]; count: number | null; cpa: number | null; dates: string[]; value: number | null; valueLabel: string | null; includeInContactCpa: boolean };
type DirectionReport = { name: string; spend: number | null; impressions: number | null; clicks: number | null; ctr: number | null; goals: GoalReport[]; contactCpa: number | null };
export type WeeklyStatusReport = { projectName: string; reportUrl: string | null; period: Period; directions: DirectionReport[]; errors: string[] };
type FallbackData = { spend?: number; impressions?: number; clicks?: number; goals: Record<string, number> };

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function russianNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits, minimumFractionDigits: 0 }).format(value).replaceAll("\u00a0", " ");
}

function money(value: number | null): string {
  return value === null ? "нет данных" : `${russianNumber(value, 2)} ₽`;
}

function dateLabel(date: string): string {
  const [, month, day] = date.split("-");
  return month && day ? `${day}.${month}` : date;
}

function periodLabel(period: Period): string {
  return `${dateLabel(period.from)}.${period.from.slice(0, 4)}–${dateLabel(period.to)}.${period.to.slice(0, 4)}`;
}

function moscowDate(now: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function previousFullMoscowWeek(now = new Date()): Period {
  return previousWeekPeriod(new Date(`${moscowDate(now)}T12:00:00.000Z`));
}

function goalLine(goal: GoalReport): string {
  const result = goal.count === null ? "нет данных" : goal.count === 0 ? "0 / —" : `${russianNumber(goal.count)}${goal.dates.length ? ` (${goal.dates.join(" и ")})` : ""} / CPA ${money(goal.cpa)}`;
  return `${escapeHtml(goal.label)}: ${result}`;
}

/** One project = one Telegram post. Values are deliberately never inferred from another goal. */
export function formatWeeklyStatusMessage(report: WeeklyStatusReport): string {
  const blocks = [
    `<b>${escapeHtml(report.projectName)}</b>`,
    `<b>${periodLabel(report.period)}</b>`,
    ...(report.reportUrl ? [`Отчёт: <a href="${escapeHtml(report.reportUrl)}">открыть таблицу</a>`] : []),
  ];
  for (const direction of report.directions) {
    const rows = [
      `<b>${escapeHtml(direction.name)}</b>`,
      `Расход с НДС: ${money(direction.spend)}`,
      `Показы: ${direction.impressions === null ? "нет данных" : russianNumber(direction.impressions)}`,
      `Клики: ${direction.clicks === null ? "нет данных" : russianNumber(direction.clicks)}`,
      `CTR: ${direction.ctr === null ? "нет данных" : `${russianNumber(direction.ctr, 2)}%`}`,
      "",
      ...direction.goals.flatMap((goal) => [goalLine(goal), ...(goal.valueLabel ? [`${escapeHtml(goal.valueLabel)}: ${goal.value === null ? "—" : `${russianNumber(goal.value, 2)} ₽`}`] : [])]),
    ];
    if (direction.goals.some((goal) => goal.includeInContactCpa)) rows.push(`CPA обращений: ${direction.contactCpa === null ? "нет данных" : money(direction.contactCpa)}`);
    blocks.push(rows.join("\n"));
  }
  return blocks.join("\n\n");
}

function summarizeGoal(goal: Goal, rows: Conversion[], spend: number | null, errors: string[], directionName: string, fallbackCount?: number): GoalReport {
  if (!rows.length || rows.some((row) => !row.is_measured)) {
    if (fallbackCount !== undefined) return { label: goal.business_label, metricKind: goal.metric_kind, count: fallbackCount, cpa: fallbackCount > 0 && spend !== null ? spend / fallbackCount : null, dates: [], value: null, valueLabel: goal.value_label, includeInContactCpa: goal.include_in_contact_cpa };
    errors.push(`${directionName}: нет полного измерения цели ${goal.goal_id}.`);
    return { label: goal.business_label, metricKind: goal.metric_kind, count: null, cpa: null, dates: [], value: null, valueLabel: goal.value_label, includeInContactCpa: goal.include_in_contact_cpa };
  }
  const count = rows.reduce((sum, row) => sum + Number(row.count), 0);
  const dates = [...new Set(rows.filter((row) => row.count > 0).map((row) => dateLabel(row.date)))];
  const value = goal.value_label
    ? (goal.metric_kind === "purchase" && count === 0 ? 0 : rows.some((row) => !row.value_is_measured) ? null : rows.reduce((sum, row) => sum + Number(row.value), 0))
    : null;
  return { label: goal.business_label, metricKind: goal.metric_kind, count, cpa: count > 0 && spend !== null ? spend / count : null, dates, value, valueLabel: goal.value_label, includeInContactCpa: goal.include_in_contact_cpa };
}

function summarizeDirection(direction: Direction, goals: Goal[], campaigns: Campaign[], metrics: Metric[], conversions: Conversion[], errors: string[], fallback?: FallbackData): DirectionReport {
  const campaignIds = new Set(campaigns.filter((campaign) => campaign.metrika_counter_ids.includes(direction.counter_id)).map((campaign) => campaign.id));
  if (!campaignIds.size) errors.push(`${direction.name}: для счётчика ${direction.counter_id} нет кампаний Agency OS.`);
  const directionMetrics = metrics.filter((row) => campaignIds.has(row.campaign_id));
  const measuredSpend = directionMetrics.length && directionMetrics.every((row) => row.spend_includes_vat);
  if (directionMetrics.length && !measuredSpend) errors.push(`${direction.name}: расход без подтверждённого НДС.`);
  const spend = measuredSpend ? directionMetrics.reduce((sum, row) => sum + Number(row.spend), 0) : fallback?.spend ?? null;
  const impressions = directionMetrics.length ? directionMetrics.reduce((sum, row) => sum + Number(row.impressions), 0) : fallback?.impressions ?? null;
  const clicks = directionMetrics.length ? directionMetrics.reduce((sum, row) => sum + Number(row.clicks), 0) : fallback?.clicks ?? null;
  if (!directionMetrics.length) errors.push(`${direction.name}: нет нормализованных метрик за период.`);
  const goalReports = goals.sort((a, b) => a.sort_order - b.sort_order).map((goal) => summarizeGoal(goal, conversions.filter((row) => campaignIds.has(row.campaign_id) && row.action_type === goal.action_type), spend, errors, direction.name, fallback?.goals[goal.metric_kind]));
  const contactGoals = goalReports.filter((goal) => goal.includeInContactCpa);
  const totalContacts = contactGoals.some((goal) => goal.count === null) ? null : contactGoals.reduce((sum, goal) => sum + (goal.count ?? 0), 0);
  return { name: direction.name, spend, impressions, clicks, ctr: clicks !== null && impressions !== null && impressions > 0 ? clicks / impressions * 100 : impressions === 0 && clicks !== null ? 0 : null, goals: goalReports, contactCpa: totalContacts !== null && totalContacts > 0 && spend !== null ? spend / totalContacts : totalContacts === 0 ? null : null };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ""; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') index += 1; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function fallbackNumber(value: string | undefined): number | undefined {
  const normalized = (value ?? "").replaceAll(" ", "").replaceAll("\u00a0", "").replaceAll("₽", "").replace(",", ".");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function loadSheetFallback(source: unknown, directions: Direction[], period: Period, errors: string[]): Promise<Map<string, FallbackData>> {
  if (!source || typeof source !== "object") return new Map();
  const config = source as { type?: string; url?: string; week_column?: string; columns?: Record<string, string> };
  if (config.type !== "google_sheet_csv" || !config.url || !config.week_column || !config.columns) return new Map();
  try {
    const response = await fetch(config.url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const [header = [], ...rows] = parseCsv(await response.text());
    const index = new Map(header.map((value, position) => [value.trim(), position]));
    const weekNeedle = `${dateLabel(period.from)}–${dateLabel(period.to)}`;
    const weekIndex = index.get(config.week_column);
    if (weekIndex === undefined) throw new Error(`нет колонки ${config.week_column}`);
    const output = new Map<string, FallbackData>();
    for (const direction of directions) {
      const match = direction.fallback_match && typeof direction.fallback_match === "object" ? direction.fallback_match as Record<string, string> : {};
      const matching = rows.filter((row) => String(row[weekIndex] ?? "").includes(weekNeedle) && Object.entries(match).every(([column, value]) => row[index.get(column) ?? -1] === value));
      if (!matching.length) continue;
      const sum = (key: string) => matching.reduce<number | undefined>((total, row) => {
        const column = index.get(config.columns![key]); const value = column === undefined ? undefined : fallbackNumber(row[column]);
        return value === undefined ? total : (total ?? 0) + value;
      }, undefined);
      const goals: Record<string, number> = {};
      for (const key of ["cart", "purchase", "phone", "messenger", "form"]) { const value = sum(key); if (value !== undefined) goals[key] = value; }
      output.set(direction.id, { spend: sum("spend"), impressions: sum("impressions"), clicks: sum("clicks"), goals });
    }
    return output;
  } catch (error) {
    errors.push(`Резервный лист: ${error instanceof Error ? error.message : "не удалось прочитать"}.`);
    return new Map();
  }
}

async function buildReport(scenario: Scenario, period: Period): Promise<WeeklyStatusReport> {
  const supabase = createServiceClient();
  const [{ data: project, error: projectError }, { data: directions, error: directionError }] = await Promise.all([
    supabase.from("projects").select("name").eq("id", scenario.project_id).single(),
    supabase.from("telegram_weekly_status_directions").select("id,scenario_id,name,channel,counter_id,fallback_match,sort_order,is_active").eq("scenario_id", scenario.id).eq("is_active", true).order("sort_order"),
  ]);
  if (projectError) throw projectError;
  if (directionError) throw directionError;
  const activeDirections = (directions ?? []) as Direction[];
  const directionIds = activeDirections.map((row) => row.id);
  const [{ data: goals, error: goalError }, { data: campaigns, error: campaignError }] = await Promise.all([
    directionIds.length ? supabase.from("telegram_weekly_status_goals").select("id,direction_id,goal_id,action_type,business_label,metric_kind,value_label,include_in_contact_cpa,sort_order,is_active").in("direction_id", directionIds).eq("is_active", true) : Promise.resolve({ data: [], error: null }),
    supabase.from("ad_campaigns").select("id,metrika_counter_ids").eq("project_id", scenario.project_id),
  ]);
  if (goalError) throw goalError;
  if (campaignError) throw campaignError;
  const campaignIds = (campaigns ?? []).map((row) => row.id);
  const [{ data: metrics, error: metricError }, { data: conversions, error: conversionError }] = await Promise.all([
    campaignIds.length ? supabase.from("ad_campaign_metrics").select("campaign_id,date,spend,impressions,clicks,spend_includes_vat").in("campaign_id", campaignIds).gte("date", period.from).lte("date", period.to) : Promise.resolve({ data: [], error: null }),
    campaignIds.length ? supabase.from("ad_conversions").select("campaign_id,date,action_type,count,value,is_measured,value_is_measured").in("campaign_id", campaignIds).gte("date", period.from).lte("date", period.to) : Promise.resolve({ data: [], error: null }),
  ]);
  if (metricError) throw metricError;
  if (conversionError) throw conversionError;
  const errors: string[] = [];
  const fallback = await loadSheetFallback(scenario.fallback_source, activeDirections, period, errors);
  const reports = activeDirections.map((direction) => summarizeDirection(direction, ((goals ?? []) as Goal[]).filter((goal) => goal.direction_id === direction.id), (campaigns ?? []) as Campaign[], (metrics ?? []) as Metric[], (conversions ?? []) as Conversion[], errors, fallback.get(direction.id)));
  return { projectName: project.name, reportUrl: scenario.report_url, period, directions: reports, errors };
}

async function loadActiveScenarios(): Promise<Scenario[]> {
  const { data, error } = await createServiceClient().from("telegram_weekly_status_scenarios")
    .select("id,project_id,name,channel,recipient_chat_id,report_url,template_key,fallback_source,is_active").eq("is_active", true).eq("template_key", "project_weekly_ad_status");
  if (error) throw error;
  return (data ?? []) as Scenario[];
}

/** Sends each active project scenario once per completed Moscow week. */
export async function sendDueWeeklyAdStatuses(now = new Date()) {
  const period = previousFullMoscowWeek(now);
  const supabase = createServiceClient();
  const scenarios = await loadActiveScenarios();
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const scenario of scenarios) {
    const { data: previous, error: previousError } = await supabase.from("telegram_weekly_status_deliveries").select("status").eq("scenario_id", scenario.id).eq("period_from", period.from).eq("period_to", period.to).maybeSingle();
    if (previousError) throw previousError;
    if (previous?.status === "sent") { skipped += 1; continue; }
    try {
      const report = await buildReport(scenario, period);
      const text = formatWeeklyStatusMessage(report);
      const errors = report.errors.join(" ");
      if (errors) console.error(`Weekly Telegram status ${scenario.name}: ${errors}`);
      const { error: pendingError } = await supabase.from("telegram_weekly_status_deliveries").upsert({ scenario_id: scenario.id, period_from: period.from, period_to: period.to, message_text: text, status: "pending", last_error: errors || null }, { onConflict: "scenario_id,period_from,period_to" });
      if (pendingError) throw pendingError;
      const message = await sendTelegramMessage(scenario.recipient_chat_id, text);
      const { error: sentError } = await supabase.from("telegram_weekly_status_deliveries").update({ status: "sent", sent_at: new Date().toISOString(), sent_message_id: message.message_id, last_error: errors || null }).eq("scenario_id", scenario.id).eq("period_from", period.from).eq("period_to", period.to);
      if (sentError) throw sentError;
      sent += 1;
    } catch (error) {
      const lastError = error instanceof Error ? error.message.slice(0, 500) : "Weekly Telegram status failed";
      await supabase.from("telegram_weekly_status_deliveries").upsert({ scenario_id: scenario.id, period_from: period.from, period_to: period.to, message_text: "", status: "failed", last_error: lastError }, { onConflict: "scenario_id,period_from,period_to" });
      failed += 1;
    }
  }
  return { period, sent, skipped, failed };
}
