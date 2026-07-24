-- Agency OS: повторяющиеся задачи (сторис/рилс/карусели и любые регулярные дела)

-- Шаблон повторяющейся задачи
CREATE TABLE IF NOT EXISTS public.recurring_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  workstream text,
  assignee_id uuid REFERENCES public.profiles(id),
  creator_id uuid REFERENCES public.profiles(id),
  task_type task_type NOT NULL DEFAULT 'other',
  priority task_priority NOT NULL DEFAULT 'medium',
  frequency text NOT NULL CHECK (frequency IN ('daily', 'every_other_day', 'weekly')),
  weekdays smallint[],            -- для weekly: 0=Вс … 6=Сб (extract(dow))
  anchor_date date NOT NULL DEFAULT current_date, -- точка отсчёта для every_other_day
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Связь сгенерированной задачи с шаблоном (чтобы не дублировать за день)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurring_task_id uuid
    REFERENCES public.recurring_tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_recurring_task_id_idx ON public.tasks (recurring_task_id);

-- RLS: администратор управляет; исполнитель видит свои шаблоны
ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin manages recurring" ON public.recurring_tasks;
CREATE POLICY "admin manages recurring" ON public.recurring_tasks
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "assignee reads recurring" ON public.recurring_tasks;
CREATE POLICY "assignee reads recurring" ON public.recurring_tasks
  FOR SELECT USING (public.is_admin() OR assignee_id = auth.uid());

-- Генерация задач на дату по активным шаблонам (идемпотентно)
CREATE OR REPLACE FUNCTION public.generate_recurring_tasks(target date DEFAULT current_date)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.recurring_tasks%ROWTYPE;
  cnt integer := 0;
  due_today boolean;
BEGIN
  FOR r IN SELECT * FROM public.recurring_tasks WHERE is_active LOOP
    due_today :=
      (r.frequency = 'daily')
      OR (r.frequency = 'every_other_day' AND ((target - r.anchor_date) % 2) = 0)
      OR (r.frequency = 'weekly' AND r.weekdays IS NOT NULL
          AND EXTRACT(DOW FROM target)::smallint = ANY (r.weekdays));

    IF due_today AND NOT EXISTS (
      SELECT 1 FROM public.tasks
      WHERE recurring_task_id = r.id AND due_date = target
    ) THEN
      INSERT INTO public.tasks
        (title, project_id, workstream, assignee_id, creator_id,
         task_type, priority, due_date, recurring_task_id, status)
      VALUES
        (r.title, r.project_id, r.workstream, r.assignee_id, r.creator_id,
         r.task_type, r.priority, target, r.id, 'todo');
      cnt := cnt + 1;
    END IF;
  END LOOP;
  RETURN cnt;
END;
$$;

-- Ежедневный запуск в 03:00 UTC (~06:00 МСК)
SELECT cron.schedule(
  'generate-recurring-tasks',
  '0 3 * * *',
  $$SELECT public.generate_recurring_tasks();$$
);
