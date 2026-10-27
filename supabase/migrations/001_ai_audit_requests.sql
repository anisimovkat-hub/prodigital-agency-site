-- Заявки на персональный AI-разбор со страницы /ai-diagnostika/.
-- Пишет только Edge Function ai-advisor (service role). Публичного доступа нет.
-- НЕ ПРИМЕНЕНО — применить вместе с деплоем функции после согласования.

create table if not exists public.ai_audit_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ip_hash text not null,               -- sha256(ip), сам IP не храним
  answers jsonb not null default '{}',
  situation text not null,
  contact text,                        -- Telegram или телефон, если человек оставил
  page text,
  model text,
  status text not null default 'new',  -- new | done | refused | rate_limited | failed | api_error_*
  result jsonb,
  error text,
  input_tokens int,
  output_tokens int
);

create index if not exists ai_audit_requests_ip_time on public.ai_audit_requests (ip_hash, created_at desc);
create index if not exists ai_audit_requests_time on public.ai_audit_requests (created_at desc);

alter table public.ai_audit_requests enable row level security;
-- Читать заявки может только админ Agency OS (как у остальных таблиц).
create policy "ai_audit_requests admin read" on public.ai_audit_requests
  for select to authenticated using (is_admin());
