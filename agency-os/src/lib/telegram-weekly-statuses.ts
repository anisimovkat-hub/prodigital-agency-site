import "server-only";

import { previousWeekPeriod } from "@/lib/analytics-period";
import { fetchConnectedDays, storeCampaignDays, type ConnectedPlatform } from "@/lib/connected-ads-sync";
import { sendTelegramMessage } from "@/lib/telegram";
import { resolveTelegramRecipientChatId } from "@/lib/telegram-recipient";
import { createServiceClient } from "@/lib/supabase/service";

type Period = { from: string; to: string };
type Scenario = { id: string; project_id: string; name: string; channel: string; recipient_chat_id: string | null; recipient_profile_id: string | null; report_url: string | null; template_key: string; fallback_source: unknown; coverage_rules: unknown; display_title: string | null; show_direction_heading: boolean; spend_label: string; schedule: string; delivery_mode: "owner_review" | "staff_auto"; is_active: boolean };
type Direction = { id: string; scenario_id: string; project_direction_id: string | null; name: string; channel: string; counter_id: string | null; ad_account_id: string | null; include_counterless_campaigns: boolean; campaign_ids: string[]; campaign_name_prefix: string | null; require_vat: boolean; allow_no_goals: boolean; spend_label: string | null; fallback_match: unknown; sort_order: number; is_active: boolean };
type ProjectDirection = { id: string; counter_ids: string[]; campaign_ids: string[]; is_active: boolean };
type Goal = { id: string; direction_id: string; goal_id: string; action_type: string; business_label: string; metric_kind: "cart" | "purchase" | "phone" | "messenger" | "form" | "subscription" | "card_view" | "join" | "engagement"; value_label: string | null; include_in_contact_cpa: boolean; sort_order: number; is_active: boolean };
type Campaign = { id: string; name: string; ad_account_id: string; metrika_counter_ids: string[] };
type Account = { id: string; platform: string; last_sync_at: string | null; last_sync_error: string | null; yandex_goals: unknown };
type Metric = { campaign_id: string; date: string; spend: number; impressions: number; clicks: number; spend_includes_vat: boolean };
type Conversion = { campaign_id: string; date: string; action_type: string; count: number; value: number; is_measured: boolean; value_is_measured: boolean };

type GoalReport = { label: string; metricKind: Goal["metric_kind"]; count: number | null; cpa: number | null; dates: string[]; value: number | null; valueLabel: string | null; includeInContactCpa: boolean };
type DirectionReport = { name: string; spend: number | null; spendLabel?: string | null; impressions: number | null; clicks: number | null; ctr: number | null; goals: GoalReport[]; contactCpa: number | null; contactCpaMissing?: boolean };
export type WeeklyStatusReport = { projectName: string; reportUrl: string | null; period: Period; directions: DirectionReport[]; errors: string[]; showDirectionHeading?: boolean; spendLabel?: string };
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

/** Schedules are UTC crons; allow Vercel's documented one-hour Hobby delay. */
export function weeklyScheduleMatches(schedule: string, now: Date): boolean {
  const match = /^(\d{1,2}) (\d{1,2}) \* \* 1$/.exec(schedule);
  const minuteOfDay = now.getUTCHours() * 60 + now.getUTCMinutes();
  const scheduledMinute = match ? Number(match[2]) * 60 + Number(match[1]) : -1;
  return !!match && now.getUTCDay() === 1
    && minuteOfDay >= scheduledMinute && minuteOfDay < scheduledMinute + 60;
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
      ...(report.showDirectionHeading === false ? [] : [`<b>${escapeHtml(direction.name)}</b>`]),
      `${escapeHtml(direction.spendLabel ?? report.spendLabel ?? "Расход с НДС")}: ${money(direction.spend)}`,
      `Показы: ${direction.impressions === null ? "нет данных" : russianNumber(direction.impressions)}`,
      `Клики: ${direction.clicks === null ? "нет данных" : russianNumber(direction.clicks)}`,
      `CTR: ${direction.ctr === null ? "нет данных" : `${russianNumber(direction.ctr, 2)}%`}`,
      "",
      ...direction.goals.flatMap((goal) => [goalLine(goal), ...(goal.valueLabel ? [`${escapeHtml(goal.valueLabel)}: ${goal.value === null ? "—" : `${russianNumber(goal.value, 2)} ₽`}`] : [])]),
    ];
    if (direction.goals.some((goal) => goal.includeInContactCpa)) rows.push(`CPA обращений: ${direction.contactCpa === null ? (direction.contactCpaMissing ? "нет данных" : "—") : money(direction.contactCpa)}`);
    blocks.push(rows.join("\n").trimEnd());
  }
  return blocks.join("\n\n");
}

/** Missing data may be shown to the owner for review, but never auto-published to staff. */
export function formatWeeklyOwnerPreview(report: WeeklyStatusReport): string {
  const message = formatWeeklyStatusMessage(report);
  if (!report.errors.length) return message;
  const warnings = report.errors.slice(0, 5).map((error) => `• ${escapeHtml(error)}`);
  if (report.errors.length > 5) warnings.push(`• И ещё ${report.errors.length - 5} замечаний.`);
  return `${message}\n\n⚠️ <b>Черновик: данные нужно проверить</b>\n${warnings.join("\n")}`;
}

function summarizeGoal(goal: Goal, rows: Conversion[], expectedDays: Set<string>, spend: number | null, errors: string[], directionName: string, fallbackCount?: number): GoalReport {
  if (!expectedDays.size || rows.some((row) => !row.is_measured) || rows.length !== expectedDays.size || rows.some((row) => !expectedDays.has(`${row.campaign_id}:${row.date}`))) {
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

export function goalCounterVerified(catalog: unknown, goalId: string, counterId: string | null): boolean {
  return !!counterId && Array.isArray(catalog) && catalog.some((item) =>
    item && typeof item === "object" && item.id === goalId && item.counterId === counterId);
}

export function directionCampaignIds(direction: Pick<Direction, "counter_id" | "ad_account_id" | "include_counterless_campaigns"> & { campaign_ids?: string[]; campaign_name_prefix?: string | null }, campaigns: Campaign[], assignedCampaignIds?: Set<string>): Set<string> {
  const explicit = direction.campaign_ids?.length ? new Set(direction.campaign_ids) : assignedCampaignIds;
  // A campaign with several counters is safe only when Agency OS explicitly
  // assigns it to this direction. Goal IDs are then scoped to its counter.
  const assigned = !!explicit?.size;
  const prefix = direction.campaign_name_prefix?.trim().toLocaleLowerCase("ru-RU");
  if (!direction.counter_id && (!direction.ad_account_id || (!explicit?.size && (!prefix || prefix.length < 4)))) return new Set();
  return new Set(campaigns.filter((campaign) =>
    (!explicit || explicit.has(campaign.id))
    && (!prefix || campaign.name.toLocaleLowerCase("ru-RU").startsWith(prefix))
    && (!direction.ad_account_id || campaign.ad_account_id === direction.ad_account_id)
    && (direction.counter_id === null
      ? true
      : (assigned || campaign.metrika_counter_ids.length <= 1)
        && (campaign.metrika_counter_ids.includes(direction.counter_id)
          || (assigned && direction.ad_account_id && direction.include_counterless_campaigns && campaign.metrika_counter_ids.length === 0))),
  ).map((campaign) => campaign.id));
}

export function uncoveredWeeklyCampaigns(rules: unknown, campaigns: Campaign[], metrics: Metric[], covered: Set<string>): string[] {
  if (!Array.isArray(rules)) return ["Неверные правила охвата кампаний."];
  const active = new Set(metrics.map((row) => row.campaign_id));
  const unmatched: string[] = [];
  for (const rule of rules) {
    if (!rule || typeof rule !== "object" || typeof rule.ad_account_id !== "string" || typeof rule.prefix !== "string" || rule.prefix.trim().length < 4)
      return ["Неверные правила охвата кампаний."];
    const prefix = rule.prefix.trim().toLocaleLowerCase("ru-RU");
    for (const campaign of campaigns) {
      if (campaign.ad_account_id === rule.ad_account_id && active.has(campaign.id)
        && campaign.name.toLocaleLowerCase("ru-RU").startsWith(prefix) && !covered.has(campaign.id))
        unmatched.push(campaign.name);
    }
  }
  return [...new Set(unmatched)];
}

function summarizeDirection(direction: Direction, goals: Goal[], campaigns: Campaign[], metrics: Metric[], conversions: Conversion[], errors: string[], fallback?: FallbackData, projectDirection?: ProjectDirection): DirectionReport {
  if (direction.project_direction_id && (!projectDirection?.is_active || !direction.counter_id || !projectDirection.counter_ids.includes(direction.counter_id) || !projectDirection.campaign_ids.length))
    errors.push(`${direction.name}: направление Agency OS неактивно, не содержит нужный счётчик или не имеет назначенных кампаний.`);
  const assigned = direction.project_direction_id ? new Set(projectDirection?.campaign_ids ?? []) : undefined;
  const campaignIds = directionCampaignIds(direction, campaigns, assigned);
  const expected = direction.campaign_ids.length ? direction.campaign_ids.length : assigned?.size;
  if (expected !== undefined && expected !== campaignIds.size)
    errors.push(`${direction.name}: часть назначенных кампаний отсутствует или не относится к заданному кабинету и счётчику.`);
  if (!campaignIds.size) errors.push(`${direction.name}: нет кампаний Agency OS в заданной области.`);
  const directionMetrics = metrics.filter((row) => campaignIds.has(row.campaign_id));
  const measuredSpend = directionMetrics.length && (!direction.require_vat || directionMetrics.every((row) => row.spend_includes_vat));
  if (directionMetrics.length && !measuredSpend) errors.push(`${direction.name}: расход без подтверждённого НДС.`);
  let spend = measuredSpend ? directionMetrics.reduce((sum, row) => sum + Number(row.spend), 0) : fallback?.spend ?? null;
  const impressions = directionMetrics.length ? directionMetrics.reduce((sum, row) => sum + Number(row.impressions), 0) : fallback?.impressions ?? null;
  const clicks = directionMetrics.length ? directionMetrics.reduce((sum, row) => sum + Number(row.clicks), 0) : fallback?.clicks ?? null;
  if (!directionMetrics.length) errors.push(`${direction.name}: нет нормализованных метрик за период.`);
  if (spend === 0 && clicks !== null && clicks > 0) {
    errors.push(`${direction.name}: расход равен нулю при ${clicks} кликах — проверьте выгрузку и тип оплаты.`);
    spend = null;
  }
  const expectedDays = new Set(directionMetrics.map((row) => `${row.campaign_id}:${row.date}`));
  if (!goals.length && !direction.allow_no_goals) errors.push(`${direction.name}: не настроены цели.`);
  const kindCounts = new Map(goals.map((goal) => [goal.metric_kind, goals.filter((item) => item.metric_kind === goal.metric_kind).length]));
  const goalReports = goals.sort((a, b) => a.sort_order - b.sort_order).map((goal) => summarizeGoal(goal, conversions.filter((row) => campaignIds.has(row.campaign_id) && row.action_type === goal.action_type), expectedDays, spend, errors, direction.name, kindCounts.get(goal.metric_kind) === 1 ? fallback?.goals[goal.metric_kind] : undefined));
  const contactGoals = goalReports.filter((goal) => goal.includeInContactCpa);
  const totalContacts = contactGoals.some((goal) => goal.count === null) ? null : contactGoals.reduce((sum, goal) => sum + (goal.count ?? 0), 0);
  return { name: direction.name, spend, spendLabel: direction.spend_label, impressions, clicks, ctr: clicks !== null && impressions !== null && impressions > 0 ? clicks / impressions * 100 : impressions === 0 && clicks !== null ? 0 : null, goals: goalReports, contactCpa: totalContacts !== null && totalContacts > 0 && spend !== null ? spend / totalContacts : null, contactCpaMissing: totalContacts === null || spend === null };
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

/** Supabase returns at most one page by default; large goal catalogs need paging. */
export async function collectWeeklyPages<T>(fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>, pageSize = 1000): Promise<T[]> {
  const output: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    output.push(...(data ?? []));
    if ((data ?? []).length < pageSize) return output;
  }
}

async function loadWeeklyMetrics(supabase: ReturnType<typeof createServiceClient>, campaignIds: string[], period: Period): Promise<Metric[]> {
  const output: Metric[] = [];
  for (let index = 0; index < campaignIds.length; index += 100) {
    const ids = campaignIds.slice(index, index + 100);
    output.push(...await collectWeeklyPages(async (from, to) => supabase.from("ad_campaign_metrics")
      .select("campaign_id,date,spend,impressions,clicks,spend_includes_vat")
      .in("campaign_id", ids).gte("date", period.from).lte("date", period.to)
      .order("campaign_id").order("date").range(from, to)) as Metric[]);
  }
  return output;
}

async function loadWeeklyConversions(supabase: ReturnType<typeof createServiceClient>, campaignIds: string[], actionTypes: string[], period: Period): Promise<Conversion[]> {
  if (!actionTypes.length) return [];
  const output: Conversion[] = [];
  for (let index = 0; index < campaignIds.length; index += 100) {
    const ids = campaignIds.slice(index, index + 100);
    output.push(...await collectWeeklyPages(async (from, to) => supabase.from("ad_conversions")
      .select("campaign_id,date,action_type,count,value,is_measured,value_is_measured")
      .in("campaign_id", ids).in("action_type", actionTypes)
      .gte("date", period.from).lte("date", period.to)
      .order("campaign_id").order("date").order("action_type").range(from, to)) as Conversion[]);
  }
  return output;
}

async function buildReport(scenario: Scenario, period: Period, freshlySyncedAccounts = new Set<string>()): Promise<WeeklyStatusReport> {
  const supabase = createServiceClient();
  const [{ data: project, error: projectError }, { data: directions, error: directionError }] = await Promise.all([
    supabase.from("projects").select("name").eq("id", scenario.project_id).single(),
    supabase.from("telegram_weekly_status_directions").select("id,scenario_id,project_direction_id,name,channel,counter_id,ad_account_id,include_counterless_campaigns,campaign_ids,campaign_name_prefix,require_vat,allow_no_goals,spend_label,fallback_match,sort_order,is_active").eq("scenario_id", scenario.id).eq("is_active", true).order("sort_order"),
  ]);
  if (projectError) throw projectError;
  if (directionError) throw directionError;
  const activeDirections = (directions ?? []) as Direction[];
  const directionIds = activeDirections.map((row) => row.id);
  const projectDirectionIds = [...new Set(activeDirections.map((row) => row.project_direction_id).filter((id): id is string => !!id))];
  const [{ data: goals, error: goalError }, { data: campaigns, error: campaignError }, { data: projectDirections, error: projectDirectionError }] = await Promise.all([
    directionIds.length ? supabase.from("telegram_weekly_status_goals").select("id,direction_id,goal_id,action_type,business_label,metric_kind,value_label,include_in_contact_cpa,sort_order,is_active").in("direction_id", directionIds).eq("is_active", true) : Promise.resolve({ data: [], error: null }),
    supabase.from("ad_campaigns").select("id,name,ad_account_id,metrika_counter_ids").eq("project_id", scenario.project_id),
    projectDirectionIds.length ? supabase.from("project_ad_directions").select("id,counter_ids,campaign_ids,is_active").eq("project_id", scenario.project_id).in("id", projectDirectionIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (goalError) throw goalError;
  if (campaignError) throw campaignError;
  if (projectDirectionError) throw projectDirectionError;
  const errors: string[] = [];
  if (!activeDirections.length) errors.push("Нет активных направлений для отчёта.");
  const usedCampaigns = new Set<string>();
  for (const direction of activeDirections) {
    for (const campaignId of directionCampaignIds(direction, (campaigns ?? []) as Campaign[], direction.project_direction_id
      ? new Set((projectDirections as ProjectDirection[]).find((row) => row.id === direction.project_direction_id)?.campaign_ids ?? []) : undefined)) {
      if (usedCampaigns.has(campaignId)) errors.push(`${direction.name}: кампания включена в несколько направлений одного статуса.`);
      usedCampaigns.add(campaignId);
    }
  }
  const accountIds = [...new Set(activeDirections.map((row) => row.ad_account_id).filter((id): id is string => !!id))];
  const { data: accounts, error: accountError } = accountIds.length
    ? await supabase.from("ad_accounts").select("id,platform,last_sync_at,last_sync_error,yandex_goals").eq("project_id", scenario.project_id).in("id", accountIds)
    : { data: [] as Account[], error: null };
  if (accountError) throw accountError;
  const campaignIds = (campaigns ?? []).map((row) => row.id);
  const [metrics, conversions] = await Promise.all([
    loadWeeklyMetrics(supabase, campaignIds, period),
    loadWeeklyConversions(supabase, [...usedCampaigns], [...new Set(((goals ?? []) as Goal[]).map((goal) => goal.action_type))], period),
  ]);
  const periodEndUtc = Date.parse(`${period.to}T21:00:00.000Z`);
  for (const direction of activeDirections) {
    if (direction.channel !== "yandex_direct" && (!direction.ad_account_id || (!direction.campaign_ids.length && !direction.campaign_name_prefix) || direction.require_vat || !direction.spend_label))
      errors.push(`${direction.name}: для неяндексового канала нужны кабинет, явные кампании и корректная подпись расхода.`);
    if (!direction.ad_account_id) continue;
    const account = (accounts as Account[]).find((row) => row.id === direction.ad_account_id);
    if (!account) errors.push(`${direction.name}: рекламный кабинет не найден в проекте.`);
    else if (account.platform !== direction.channel) errors.push(`${direction.name}: площадка кабинета не совпадает с направлением.`);
    else if (!freshlySyncedAccounts.has(account.id) && (account.last_sync_error || !account.last_sync_at || Date.parse(account.last_sync_at) < periodEndUtc))
      errors.push(`${direction.name}: рекламный кабинет не обновлён после завершения отчётной недели${account.last_sync_error ? ` (${account.last_sync_error})` : ""}.`);
    if (account?.platform === "yandex_direct") {
      for (const goal of (goals ?? []) as Goal[]) {
        if (goal.direction_id !== direction.id) continue;
        if (!goalCounterVerified(account.yandex_goals, goal.goal_id, direction.counter_id))
          errors.push(`${direction.name}: счётчик цели ${goal.goal_id} не подтверждён в Agency OS.`);
      }
    }
  }
  for (const name of uncoveredWeeklyCampaigns(scenario.coverage_rules, (campaigns ?? []) as Campaign[], metrics, usedCampaigns))
    errors.push(`Не включена в статус кампания: ${name}.`);
  const fallback = await loadSheetFallback(scenario.fallback_source, activeDirections, period, errors);
  const reports = activeDirections.map((direction) => summarizeDirection(direction, ((goals ?? []) as Goal[]).filter((goal) => goal.direction_id === direction.id), (campaigns ?? []) as Campaign[], metrics, conversions, errors, fallback.get(direction.id), (projectDirections as ProjectDirection[]).find((row) => row.id === direction.project_direction_id)));
  return { projectName: scenario.display_title ?? project.name, reportUrl: scenario.report_url, period, directions: reports, errors, showDirectionHeading: scenario.show_direction_heading, spendLabel: scenario.spend_label };
}

async function loadActiveScenarios(): Promise<Scenario[]> {
  const { data, error } = await createServiceClient().from("telegram_weekly_status_scenarios")
    .select("id,project_id,name,channel,recipient_chat_id,recipient_profile_id,report_url,template_key,fallback_source,coverage_rules,display_title,show_direction_heading,spend_label,schedule,delivery_mode,is_active").eq("is_active", true).eq("template_key", "project_weekly_ad_status");
  if (error) throw error;
  return (data ?? []) as Scenario[];
}

/** Refresh only the configured goals through the shared Agency OS importer. */
async function refreshWeeklySources(scenario: Scenario, period: Period): Promise<{ fresh: Set<string>; errors: string[] }> {
  const service = createServiceClient();
  const { data: directions, error: directionError } = await service.from("telegram_weekly_status_directions")
    .select("id,ad_account_id,channel").eq("scenario_id", scenario.id).eq("is_active", true);
  if (directionError) throw directionError;
  const directionIds = (directions ?? []).map((direction) => direction.id);
  const { data: goals, error: goalError } = directionIds.length
    ? await service.from("telegram_weekly_status_goals").select("direction_id,goal_id").in("direction_id", directionIds).eq("is_active", true)
    : { data: [], error: null };
  if (goalError) throw goalError;
  const fresh = new Set<string>();
  const errors: string[] = [];
  const scopes = new Map<string, { channel: ConnectedPlatform; goalIds: Set<string> }>();
  for (const direction of directions ?? []) {
    if (!direction.ad_account_id) continue;
    const current = scopes.get(direction.ad_account_id) ?? { channel: direction.channel as ConnectedPlatform, goalIds: new Set<string>() };
    if (current.channel !== direction.channel) { errors.push("Один кабинет указан с разными рекламными каналами."); continue; }
    for (const goal of goals ?? []) if (goal.direction_id === direction.id) current.goalIds.add(goal.goal_id);
    scopes.set(direction.ad_account_id, current);
  }
  for (const [accountId, scope] of scopes) {
    try {
      const days = await fetchConnectedDays(service, { id: accountId, platform: scope.channel }, period,
        scope.channel === "yandex_direct" ? [...scope.goalIds] : undefined);
      await storeCampaignDays(service, { id: accountId, project_id: scenario.project_id }, days);
      fresh.add(accountId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "неизвестная ошибка";
      errors.push(`Не удалось обновить кабинет ${accountId}: ${message}`);
      console.error(`Weekly status source refresh ${scenario.name}: ${message}`);
    }
  }
  return { fresh, errors };
}

/** Manual, owner-only preview. Inactive staging scenarios can be checked safely. */
export async function sendOwnerWeeklyStatusPreview(chatId: string, query: string, now = new Date()): Promise<string> {
  const supabase = createServiceClient();
  const { data: setting, error: settingError } = await supabase.from("telegram_bot_settings")
    .select("setting_value").eq("setting_key", "owner_chat_id").single();
  if (settingError || setting?.setting_value !== chatId) return "Черновик доступен только в личном чате владельца.";
  const { data, error } = await supabase.from("telegram_weekly_status_scenarios")
    .select("id,project_id,name,channel,recipient_chat_id,recipient_profile_id,report_url,template_key,fallback_source,coverage_rules,display_title,show_direction_heading,spend_label,schedule,delivery_mode,is_active")
    .eq("template_key", "project_weekly_ad_status").eq("delivery_mode", "owner_review");
  if (error) throw error;
  const scenarios = (data ?? []) as Scenario[];
  const needle = query.trim().toLocaleLowerCase("ru-RU");
  if (!needle) return scenarios.length
    ? `Доступные статусы: ${scenarios.map((scenario) => escapeHtml(scenario.display_title ?? scenario.name)).join(", ")}. Напишите /status и название проекта.`
    : "Сценарии еженедельных статусов пока не настроены.";
  const matches = scenarios.filter((scenario) => `${scenario.name} ${scenario.display_title ?? ""}`.toLocaleLowerCase("ru-RU").includes(needle));
  if (!matches.length) return "Такой статус не найден. Напишите /status, чтобы увидеть список.";
  if (matches.length > 1) return `Найдено несколько статусов: ${matches.map((scenario) => escapeHtml(scenario.name)).join(", ")}. Уточните название.`;
  const report = await buildReport(matches[0], previousFullMoscowWeek(now));
  await sendTelegramMessage(chatId, formatWeeklyOwnerPreview(report));
  return report.errors.length ? "Черновик отправлен с замечаниями к данным." : "Черновик отправлен за предыдущую полную неделю.";
}

/** Owner-only CRM preview for a project, using the same source refresh as the cron. */
export async function sendOwnerWeeklyStatusPreviewForProject(projectId: string, now = new Date()): Promise<string> {
  const service = createServiceClient();
  const [{ data: setting, error: settingError }, { data: scenarios, error: scenarioError }] = await Promise.all([
    service.from("telegram_bot_settings").select("setting_value").eq("setting_key", "owner_chat_id").single(),
    service.from("telegram_weekly_status_scenarios")
      .select("id,project_id,name,channel,recipient_chat_id,recipient_profile_id,report_url,template_key,fallback_source,coverage_rules,display_title,show_direction_heading,spend_label,schedule,delivery_mode,is_active")
      .eq("project_id", projectId).eq("template_key", "project_weekly_ad_status").eq("delivery_mode", "owner_review"),
  ]);
  if (settingError || !setting?.setting_value) return "Личный чат с ботом не привязан.";
  if (scenarioError) throw scenarioError;
  if (scenarios?.length !== 1) return "Для проекта нет одного однозначного сценария статуса.";
  const scenario = scenarios[0] as Scenario;
  const period = previousFullMoscowWeek(now);
  const source = await refreshWeeklySources(scenario, period);
  const report = await buildReport(scenario, period, source.fresh);
  report.errors.push(...source.errors);
  await sendTelegramMessage(setting.setting_value, formatWeeklyOwnerPreview(report));
  return report.errors.length
    ? "Черновик отправлен в личный чат с замечаниями к данным."
    : "Черновик за предыдущую неделю отправлен в личный чат.";
}

/** Sends each active project scenario once per completed Moscow week. */
export async function sendDueWeeklyAdStatuses(now = new Date()) {
  const period = previousFullMoscowWeek(now);
  const supabase = createServiceClient();
  const scenarios = (await loadActiveScenarios()).filter((scenario) => weeklyScheduleMatches(scenario.schedule, now));
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const scenario of scenarios) {
    const { data: previous, error: previousError } = await supabase.from("telegram_weekly_status_deliveries").select("status").eq("scenario_id", scenario.id).eq("period_from", period.from).eq("period_to", period.to).maybeSingle();
    if (previousError) throw previousError;
    if (previous?.status === "sent") { skipped += 1; continue; }
    try {
      const source = await refreshWeeklySources(scenario, period);
      const report = await buildReport(scenario, period, source.fresh);
      report.errors.push(...source.errors);
      const text = scenario.delivery_mode === "owner_review"
        ? formatWeeklyOwnerPreview(report)
        : formatWeeklyStatusMessage(report);
      const recipientChatId = scenario.delivery_mode === "owner_review"
        ? (await supabase.from("telegram_bot_settings").select("setting_value").eq("setting_key", "owner_chat_id").single()).data?.setting_value ?? null
        : scenario.recipient_profile_id
          ? await resolveTelegramRecipientChatId(scenario.recipient_profile_id)
          : scenario.recipient_chat_id;
      const errors = [...report.errors, ...(!recipientChatId ? ["Чат получателя не найден или привязка неоднозначна."] : [])].join(" ");
      if (!recipientChatId || (errors && scenario.delivery_mode === "staff_auto")) {
        console.error(`Weekly Telegram status ${scenario.name}: ${errors}`);
        const { error: blockedError } = await supabase.from("telegram_weekly_status_deliveries").upsert({ scenario_id: scenario.id, period_from: period.from, period_to: period.to, message_text: text, status: "blocked", last_error: errors }, { onConflict: "scenario_id,period_from,period_to" });
        if (blockedError) throw blockedError;
        failed += 1;
        continue;
      }
      const { error: pendingError } = await supabase.from("telegram_weekly_status_deliveries").upsert({ scenario_id: scenario.id, period_from: period.from, period_to: period.to, message_text: text, status: "pending", last_error: errors || null }, { onConflict: "scenario_id,period_from,period_to" });
      if (pendingError) throw pendingError;
      const message = await sendTelegramMessage(recipientChatId!, text);
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
