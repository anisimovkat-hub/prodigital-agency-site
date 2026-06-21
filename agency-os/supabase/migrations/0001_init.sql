-- Agency OS: схема базы данных
-- Применить в Supabase Dashboard → SQL Editor (или через `supabase db push`).

-- ──────────────────────────────────────────────────────────────────────────
-- profiles: данные сотрудника, привязанные к пользователю Supabase Auth.
-- Строка создаётся вручную после создания пользователя в Auth → Users.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  position text,
  role text not null default 'employee' check (role in ('admin', 'manager', 'employee')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_write_authenticated"
  on public.profiles for all
  to authenticated
  using (true)
  with check (true);

-- ──────────────────────────────────────────────────────────────────────────
-- clients: клиенты агентства
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;

create policy "clients_all_authenticated"
  on public.clients for all
  to authenticated
  using (true)
  with check (true);

-- ──────────────────────────────────────────────────────────────────────────
-- projects: проекты агентства, привязанные к клиенту
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete set null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  description text,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "projects_all_authenticated"
  on public.projects for all
  to authenticated
  using (true)
  with check (true);

-- ──────────────────────────────────────────────────────────────────────────
-- tasks: задачи внутри проектов, назначенные сотрудникам
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  assignee_id uuid references public.profiles (id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "tasks_all_authenticated"
  on public.tasks for all
  to authenticated
  using (true)
  with check (true);

create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists tasks_assignee_id_idx on public.tasks (assignee_id);
create index if not exists projects_client_id_idx on public.projects (client_id);
