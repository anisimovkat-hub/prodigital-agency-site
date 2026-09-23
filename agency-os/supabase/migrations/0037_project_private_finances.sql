-- Phase 1: copy agency fees into an owner-only table before the app switches reads.
CREATE TABLE IF NOT EXISTS public.project_finances (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  monthly_fee numeric CHECK (monthly_fee IS NULL OR monthly_fee >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_finances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads project finances" ON public.project_finances
  FOR SELECT USING (public.is_admin());
CREATE POLICY "owner inserts project finances" ON public.project_finances
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "owner updates project finances" ON public.project_finances
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "owner deletes project finances" ON public.project_finances
  FOR DELETE USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_finances TO authenticated;

INSERT INTO public.project_finances (project_id, monthly_fee)
SELECT id, monthly_fee FROM public.projects WHERE monthly_fee IS NOT NULL
ON CONFLICT (project_id) DO NOTHING;
