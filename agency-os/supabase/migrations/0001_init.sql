-- Agency OS: схема базы данных
-- Применить в Supabase Dashboard → SQL Editor (или через `supabase db push`).

-- ──────────────────────────────────────────────────────────────────────────
-- ENUM-типы
-- ──────────────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('owner','pm','specialist','viewer');
CREATE TYPE project_health AS ENUM ('green','yellow','red');
CREATE TYPE project_stage AS ENUM ('active','paused','finished');
CREATE TYPE client_status AS ENUM ('active','paused','churned');
CREATE TYPE task_status AS ENUM ('backlog','todo','in_progress','review','done','paused');
CREATE TYPE task_priority AS ENUM ('low','medium','high','urgent');
CREATE TYPE task_type AS ENUM ('ads','creative','analytics','website','content','report','communication','other');
CREATE TYPE note_type AS ENUM ('hypothesis','risk','history','client_note');

-- ──────────────────────────────────────────────────────────────────────────
-- profiles (привязаны к auth.users)
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'specialist',
  position_title text,
  phone text,
  telegram text,
  email text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- clients
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status client_status DEFAULT 'active',
  budget numeric,
  phone text,
  email text,
  telegram text,
  links jsonb DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- projects
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE RESTRICT,
  name text NOT NULL,
  health project_health DEFAULT 'green',
  stage project_stage DEFAULT 'active',
  budget numeric,
  responsible_id uuid REFERENCES profiles(id),
  short_comment text,
  links jsonb DEFAULT '{}', -- {website, ad_accounts, sheets, reports, telegram, notion}
  started_at date DEFAULT current_date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- project_members
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE project_members (
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role_on_project text,
  PRIMARY KEY (project_id, profile_id)
);

-- ──────────────────────────────────────────────────────────────────────────
-- tasks
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES profiles(id),
  creator_id uuid REFERENCES profiles(id),
  status task_status DEFAULT 'todo',
  priority task_priority DEFAULT 'medium',
  task_type task_type DEFAULT 'other',
  due_date date,
  is_important boolean DEFAULT false,
  is_urgent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- ──────────────────────────────────────────────────────────────────────────
-- task_checklist_items
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_done boolean DEFAULT false,
  position int DEFAULT 0
);

-- ──────────────────────────────────────────────────────────────────────────
-- task_comments
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id),
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- task_attachments
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  created_at timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- kpi_entries (CTR/CPC/CPL/ДРР/ROMI считаются автоматически)
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE kpi_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  spend numeric DEFAULT 0,
  impressions int DEFAULT 0,
  clicks int DEFAULT 0,
  leads int DEFAULT 0,
  sales int DEFAULT 0,
  revenue numeric DEFAULT 0,
  comment text,
  ctr numeric GENERATED ALWAYS AS (CASE WHEN impressions > 0 THEN round(clicks::numeric / impressions * 100, 2) END) STORED,
  cpc numeric GENERATED ALWAYS AS (CASE WHEN clicks > 0 THEN round(spend / clicks, 2) END) STORED,
  cpl numeric GENERATED ALWAYS AS (CASE WHEN leads > 0 THEN round(spend / leads, 2) END) STORED,
  drr numeric GENERATED ALWAYS AS (CASE WHEN revenue > 0 THEN round(spend / revenue * 100, 2) END) STORED,
  romi numeric GENERATED ALWAYS AS (CASE WHEN spend > 0 THEN round((revenue - spend) / spend * 100, 2) END) STORED,
  created_at timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- project_notes (гипотезы/риски/история/заметки по клиенту — разделены полем type)
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE project_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  type note_type NOT NULL,
  body text NOT NULL,
  status text,
  author_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- MVP с одним пользователем: разрешено всё авторизованным. Ужесточить позже.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON profiles FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated full access" ON clients FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated full access" ON projects FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated full access" ON project_members FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated full access" ON tasks FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated full access" ON task_checklist_items FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated full access" ON task_comments FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated full access" ON task_attachments FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated full access" ON kpi_entries FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated full access" ON project_notes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX projects_client_id_idx ON projects (client_id);
CREATE INDEX projects_responsible_id_idx ON projects (responsible_id);
CREATE INDEX project_members_profile_id_idx ON project_members (profile_id);
CREATE INDEX tasks_project_id_idx ON tasks (project_id);
CREATE INDEX tasks_assignee_id_idx ON tasks (assignee_id);
CREATE INDEX task_checklist_items_task_id_idx ON task_checklist_items (task_id);
CREATE INDEX task_comments_task_id_idx ON task_comments (task_id);
CREATE INDEX task_attachments_task_id_idx ON task_attachments (task_id);
CREATE INDEX kpi_entries_project_id_idx ON kpi_entries (project_id);
CREATE INDEX project_notes_project_id_idx ON project_notes (project_id);
