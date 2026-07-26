-- Agency OS: учёт времени по проектам (таймер «сейчас работаю над»)
-- Один активный интервал на пользователя (ended_at IS NULL). Переключение
-- проекта закрывает предыдущий интервал и открывает новый. Часы за период
-- суммируются из закрытых интервалов + текущего; вместе с monthly_fee дают ₽/час.

CREATE TABLE IF NOT EXISTS public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS time_entries_user_idx
  ON public.time_entries(user_id, ended_at);
CREATE INDEX IF NOT EXISTS time_entries_project_idx
  ON public.time_entries(project_id);
-- не больше одного запущенного таймера на пользователя
CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_running_per_user
  ON public.time_entries(user_id) WHERE ended_at IS NULL;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time read own or admin" ON public.time_entries;
CREATE POLICY "time read own or admin" ON public.time_entries
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "time write own" ON public.time_entries;
CREATE POLICY "time write own" ON public.time_entries
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
