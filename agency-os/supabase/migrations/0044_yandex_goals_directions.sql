-- Goal catalog and promotion directions. Does not change advertising or remove history.
ALTER TABLE public.ad_accounts ADD COLUMN IF NOT EXISTS yandex_goals jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS metrika_counter_ids text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.ad_conversions ADD COLUMN IF NOT EXISTS is_measured boolean NOT NULL DEFAULT true;

CREATE TABLE public.project_ad_directions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  counter_ids text[] NOT NULL DEFAULT '{}',
  websites text[] NOT NULL DEFAULT '{}',
  campaign_ids uuid[] NOT NULL DEFAULT '{}',
  primary_goal text,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_ad_directions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "directions owner" ON public.project_ad_directions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "directions member read" ON public.project_ad_directions FOR SELECT TO authenticated
  USING (public.is_project_member(project_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_ad_directions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_ad_directions TO service_role;

-- One persisted default goal per project; changed atomically with all goal settings.
ALTER TABLE public.project_ad_goal_settings ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX project_ad_one_primary_goal ON public.project_ad_goal_settings(project_id) WHERE is_primary;

-- Owner-only, invoker/RLS protected. Serialize writes and replace the default atomically.
CREATE FUNCTION public.save_project_ad_goals(p_project_id uuid, p_rows jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Owner access required'; END IF;
  PERFORM 1 FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) > 300 THEN
    RAISE EXCEPTION 'Invalid goal settings';
  END IF;
  UPDATE public.project_ad_goal_settings SET is_primary = false WHERE project_id = p_project_id AND is_primary;
  INSERT INTO public.project_ad_goal_settings(project_id, goal_key, label, hidden, extra, is_primary, updated_at)
  SELECT p_project_id, goal_key, label, hidden, extra, is_primary, now()
  FROM jsonb_to_recordset(p_rows) AS r(goal_key text, label text, hidden boolean, extra boolean, is_primary boolean)
  ON CONFLICT (project_id, goal_key) DO UPDATE SET label = excluded.label, hidden = excluded.hidden,
    extra = excluded.extra, is_primary = excluded.is_primary, updated_at = excluded.updated_at;
END $$;
REVOKE ALL ON FUNCTION public.save_project_ad_goals(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_project_ad_goals(uuid, jsonb) TO authenticated;

-- A campaign belongs to one project/direction, including concurrent configuration writes.
CREATE FUNCTION public.check_ad_direction_campaigns() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM public.projects WHERE id = NEW.project_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM unnest(NEW.campaign_ids) AS selected(id)
    LEFT JOIN public.ad_campaigns c ON c.id = selected.id
    LEFT JOIN public.ad_accounts a ON a.id = c.ad_account_id
    WHERE c.id IS NULL OR c.project_id IS DISTINCT FROM NEW.project_id
      OR a.project_id IS DISTINCT FROM NEW.project_id OR a.platform IS DISTINCT FROM 'yandex_direct') THEN
    RAISE EXCEPTION 'Campaign must belong to this Yandex project';
  END IF;
  IF EXISTS (SELECT 1 FROM public.project_ad_directions d WHERE d.project_id = NEW.project_id
    AND d.id <> NEW.id AND d.campaign_ids && NEW.campaign_ids) THEN
    RAISE EXCEPTION 'Campaign already belongs to another direction';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.check_ad_direction_campaigns() FROM PUBLIC, anon;
CREATE TRIGGER ad_direction_campaign_guard BEFORE INSERT OR UPDATE ON public.project_ad_directions
  FOR EACH ROW EXECUTE FUNCTION public.check_ad_direction_campaigns();
