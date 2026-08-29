-- Несколько ответственных у проекта. projects.responsible_id остаётся
-- основным ответственным для обратной совместимости существующих экранов.

CREATE TABLE IF NOT EXISTS public.project_responsibles (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sort_order smallint NOT NULL DEFAULT 1 CHECK (sort_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, profile_id)
);

CREATE INDEX IF NOT EXISTS project_responsibles_profile_id_idx
  ON public.project_responsibles(profile_id);

-- Existing single assignees become the first responsible in the new model.
INSERT INTO public.project_responsibles (project_id, profile_id, sort_order)
SELECT id, responsible_id, 1
FROM public.projects
WHERE responsible_id IS NOT NULL
ON CONFLICT (project_id, profile_id) DO NOTHING;

ALTER TABLE public.project_responsibles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responsibles read visible projects" ON public.project_responsibles;
DROP POLICY IF EXISTS "admin writes responsibles" ON public.project_responsibles;
CREATE POLICY "responsibles read visible projects" ON public.project_responsibles
  FOR SELECT USING (public.is_admin() OR public.is_project_member(project_id));
CREATE POLICY "admin writes responsibles" ON public.project_responsibles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- A selected co-responsible must receive the same project access as the
-- existing primary responsible. This function is SECURITY DEFINER to avoid
-- RLS recursion while it checks membership.
CREATE OR REPLACE FUNCTION public.is_project_member(pid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.project_id = pid AND pm.profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.id = pid AND p.responsible_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM project_responsibles pr
    WHERE pr.project_id = pid AND pr.profile_id = auth.uid()
  );
$$;

-- Replaces the entire set atomically, preserving the displayed order and the
-- old single-responsible field as the first selected person.
CREATE OR REPLACE FUNCTION public.set_project_responsibles(
  p_project_id uuid,
  p_profile_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_ids uuid[] := COALESCE(p_profile_ids, ARRAY[]::uuid[]);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only owners can change project responsibles'
      USING ERRCODE = '42501';
  END IF;

  IF (
    SELECT count(DISTINCT profile_id)
    FROM unnest(v_profile_ids) AS profile_id
  ) <> cardinality(v_profile_ids) THEN
    RAISE EXCEPTION 'Project responsibles contain duplicates';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_profile_ids) AS profile_id
    LEFT JOIN public.profiles profile ON profile.id = profile_id
    WHERE profile.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A selected responsible does not exist';
  END IF;

  PERFORM 1 FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.project_responsibles
  WHERE project_id = p_project_id;

  INSERT INTO public.project_responsibles (project_id, profile_id, sort_order)
  SELECT p_project_id, profile_id, position::smallint
  FROM unnest(v_profile_ids) WITH ORDINALITY AS selected(profile_id, position);

  UPDATE public.projects
  SET responsible_id = v_profile_ids[1]
  WHERE id = p_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_responsibles(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_project_responsibles(uuid, uuid[]) TO authenticated;
