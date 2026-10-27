-- KPI-контроль: цели по проектам и журнал алертов.
-- ПРИМЕНЕНА 27.10.2026 в Supabase agency-os (миграция kpi_targets_and_alerts) с согласия Катерины.

create table if not exists public.project_kpi_targets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  platform text,                       -- meta | yandex_direct | vk | telegram_ads | null = все площадки проекта
  metric text not null check (metric in ('cpl', 'leads_per_day', 'spend_per_day', 'budget_month', 'cpa', 'ctr', 'drr')),
  target numeric not null,
  currency text,                       -- валюта цели (для cpl, spend, budget)
  warn_pct numeric not null default 20,      -- отклонение для 🟡
  critical_pct numeric not null default 50,  -- отклонение для 🔴
  window_days int not null default 3,        -- за сколько дней считаем метрику
  lead_goal_keys text[],               -- какие конверсии считаем лидом; null = основная из project_ad_goal_settings
  is_active boolean not null default true,
  comment text,
  updated_at timestamptz not null default now(),
  unique nulls not distinct (project_id, platform, metric)
);

create table if not exists public.kpi_alerts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  alert_type text not null,            -- ads_stopped | sync_stale | spend_drop | spend_spike | cpl_over | leads_under | budget_pace | task_overdue | report_due
  severity text not null check (severity in ('warn', 'critical')),
  alert_date date not null default current_date,
  details jsonb not null default '{}',  -- цифры: факт, план, отклонение, окно
  recipient_profile_id uuid references public.profiles(id),
  telegram_message_id bigint,
  sent_at timestamptz,
  reaction text check (reaction in ('accepted', 'fixed', 'not_a_problem')),
  reacted_at timestamptz,
  escalated_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- одно отклонение — одно сообщение в день
create unique index if not exists kpi_alerts_once_per_day
  on public.kpi_alerts (coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        coalesce(task_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        alert_type, alert_date);

alter table public.project_kpi_targets enable row level security;
alter table public.kpi_alerts enable row level security;
create index if not exists kpi_alerts_project_date on public.kpi_alerts (project_id, alert_date desc);

-- RLS — как у project_ad_goal_settings: админ управляет, участники проекта читают.
create policy "project_kpi_targets admin" on public.project_kpi_targets
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "project_kpi_targets member read" on public.project_kpi_targets
  for select to authenticated using (is_project_member(project_id));
create policy "kpi_alerts admin" on public.kpi_alerts
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "kpi_alerts member read" on public.kpi_alerts
  for select to authenticated using (project_id is not null and is_project_member(project_id));
