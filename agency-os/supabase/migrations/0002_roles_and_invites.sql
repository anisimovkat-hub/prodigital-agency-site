-- Agency OS: роли, права доступа и приглашения
-- Owner (админ) видит и может всё. Специалист/ПМ видят только свои проекты
-- (где они ответственные или в команде) и свои задачи, включая личные
-- (задачи без проекта). Регистрация — только по инвайт-коду.

-- ──────────────────────────────────────────────────────────────────────────
-- Вспомогательные функции (SECURITY DEFINER — обходят RLS, без рекурсии)
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner');
$$;

CREATE OR REPLACE FUNCTION public.has_profile() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(pid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM project_members pm
                 WHERE pm.project_id = pid AND pm.profile_id = auth.uid())
      OR EXISTS (SELECT 1 FROM projects p
                 WHERE p.id = pid AND p.responsible_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_access_task(tid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = tid
      AND (public.is_admin()
        OR (t.project_id IS NOT NULL AND public.is_project_member(t.project_id))
        OR t.assignee_id = auth.uid()
        OR (t.project_id IS NULL AND t.creator_id = auth.uid()))
  );
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Приглашения
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invite_codes (
  code text PRIMARY KEY,
  role user_role NOT NULL DEFAULT 'specialist',
  full_name text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '14 days',
  used_by uuid REFERENCES profiles(id),
  used_at timestamptz
);
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin manages invites" ON invite_codes;
CREATE POLICY "admin manages invites" ON invite_codes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Триггер: регистрация только с валидным инвайт-кодом.
-- Пользователи, созданные админом напрямую (без метаданных), пропускаются.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
  v_invite invite_codes%ROWTYPE;
BEGIN
  v_code := NEW.raw_user_meta_data->>'invite_code';
  IF v_code IS NULL THEN
    RETURN NEW; -- создано администратором, профиль заводится отдельно
  END IF;

  SELECT * INTO v_invite FROM invite_codes
   WHERE code = v_code AND used_at IS NULL
     AND (expires_at IS NULL OR expires_at > now())
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Недействительный или уже использованный код приглашения';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, email, is_active)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), v_invite.full_name, split_part(NEW.email, '@', 1)),
    v_invite.role, NEW.email, true
  );

  UPDATE invite_codes SET used_by = NEW.id, used_at = now() WHERE code = v_invite.code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────────────────────────────────────
-- Ролевые политики (замена "authenticated full access")
-- ──────────────────────────────────────────────────────────────────────────

-- profiles
DROP POLICY IF EXISTS "authenticated full access" ON profiles;
DROP POLICY IF EXISTS "team reads profiles" ON profiles;
DROP POLICY IF EXISTS "self or admin updates profile" ON profiles;
DROP POLICY IF EXISTS "admin writes profiles" ON profiles;
CREATE POLICY "team reads profiles" ON profiles
  FOR SELECT USING (public.has_profile());
CREATE POLICY "self or admin updates profile" ON profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "admin writes profiles" ON profiles
  FOR INSERT WITH CHECK (public.is_admin());

-- clients
DROP POLICY IF EXISTS "authenticated full access" ON clients;
DROP POLICY IF EXISTS "member reads own clients" ON clients;
DROP POLICY IF EXISTS "admin writes clients" ON clients;
CREATE POLICY "member reads own clients" ON clients
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM projects p
               WHERE p.client_id = clients.id AND public.is_project_member(p.id))
  );
CREATE POLICY "admin writes clients" ON clients
  FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin updates clients" ON clients;
CREATE POLICY "admin updates clients" ON clients
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin deletes clients" ON clients;
CREATE POLICY "admin deletes clients" ON clients
  FOR DELETE USING (public.is_admin());

-- projects
DROP POLICY IF EXISTS "authenticated full access" ON projects;
DROP POLICY IF EXISTS "member reads own projects" ON projects;
DROP POLICY IF EXISTS "admin inserts projects" ON projects;
DROP POLICY IF EXISTS "admin or responsible updates project" ON projects;
DROP POLICY IF EXISTS "admin deletes projects" ON projects;
CREATE POLICY "member reads own projects" ON projects
  FOR SELECT USING (public.is_admin() OR public.is_project_member(id));
CREATE POLICY "admin inserts projects" ON projects
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "admin or responsible updates project" ON projects
  FOR UPDATE USING (public.is_admin() OR responsible_id = auth.uid())
  WITH CHECK (public.is_admin() OR responsible_id = auth.uid());
CREATE POLICY "admin deletes projects" ON projects
  FOR DELETE USING (public.is_admin());

-- project_members
DROP POLICY IF EXISTS "authenticated full access" ON project_members;
DROP POLICY IF EXISTS "member reads own team" ON project_members;
DROP POLICY IF EXISTS "admin writes team" ON project_members;
CREATE POLICY "member reads own team" ON project_members
  FOR SELECT USING (public.is_admin() OR public.is_project_member(project_id));
CREATE POLICY "admin writes team" ON project_members
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- tasks
DROP POLICY IF EXISTS "authenticated full access" ON tasks;
DROP POLICY IF EXISTS "member reads own tasks" ON tasks;
DROP POLICY IF EXISTS "member inserts tasks" ON tasks;
DROP POLICY IF EXISTS "member updates own tasks" ON tasks;
DROP POLICY IF EXISTS "admin or owner deletes tasks" ON tasks;
CREATE POLICY "member reads own tasks" ON tasks
  FOR SELECT USING (public.can_access_task(id));
CREATE POLICY "member inserts tasks" ON tasks
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (project_id IS NOT NULL AND public.is_project_member(project_id))
    OR (project_id IS NULL AND creator_id = auth.uid())
  );
CREATE POLICY "member updates own tasks" ON tasks
  FOR UPDATE USING (public.can_access_task(id)) WITH CHECK (public.can_access_task(id));
CREATE POLICY "admin or owner deletes tasks" ON tasks
  FOR DELETE USING (public.is_admin() OR (project_id IS NULL AND creator_id = auth.uid()));

-- task_checklist_items / task_comments / task_attachments — через доступ к задаче
DROP POLICY IF EXISTS "authenticated full access" ON task_checklist_items;
DROP POLICY IF EXISTS "via task access" ON task_checklist_items;
CREATE POLICY "via task access" ON task_checklist_items
  FOR ALL USING (public.can_access_task(task_id)) WITH CHECK (public.can_access_task(task_id));

DROP POLICY IF EXISTS "authenticated full access" ON task_comments;
DROP POLICY IF EXISTS "via task access" ON task_comments;
CREATE POLICY "via task access" ON task_comments
  FOR ALL USING (public.can_access_task(task_id)) WITH CHECK (public.can_access_task(task_id));

DROP POLICY IF EXISTS "authenticated full access" ON task_attachments;
DROP POLICY IF EXISTS "via task access" ON task_attachments;
CREATE POLICY "via task access" ON task_attachments
  FOR ALL USING (public.can_access_task(task_id)) WITH CHECK (public.can_access_task(task_id));

-- kpi_entries
DROP POLICY IF EXISTS "authenticated full access" ON kpi_entries;
DROP POLICY IF EXISTS "member accesses project kpi" ON kpi_entries;
CREATE POLICY "member accesses project kpi" ON kpi_entries
  FOR ALL USING (public.is_admin() OR public.is_project_member(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_member(project_id));

-- project_notes
DROP POLICY IF EXISTS "authenticated full access" ON project_notes;
DROP POLICY IF EXISTS "member accesses project notes" ON project_notes;
CREATE POLICY "member accesses project notes" ON project_notes
  FOR ALL USING (public.is_admin() OR public.is_project_member(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_member(project_id));
