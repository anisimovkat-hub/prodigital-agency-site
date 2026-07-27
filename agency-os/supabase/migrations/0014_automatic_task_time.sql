-- Agency OS: автоматический учёт времени по статусу задачи.
-- Интервал открывается, пока задача находится «В работе», и закрывается при любом
-- другом статусе. Несколько задач одного сотрудника могут идти параллельно.

CREATE TABLE IF NOT EXISTS public.task_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Намеренно без FK: история трудозатрат остаётся после планового удаления задачи.
  task_id uuid NOT NULL,
  task_title text NOT NULL,
  task_type public.task_type,
  workstream text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_time_entries_valid_interval
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS task_time_entries_task_idx
  ON public.task_time_entries(task_id, started_at);
CREATE INDEX IF NOT EXISTS task_time_entries_project_idx
  ON public.task_time_entries(project_id, started_at);
CREATE INDEX IF NOT EXISTS task_time_entries_user_idx
  ON public.task_time_entries(user_id, started_at);
CREATE UNIQUE INDEX IF NOT EXISTS task_time_entries_one_running_per_task
  ON public.task_time_entries(task_id) WHERE ended_at IS NULL;

ALTER TABLE public.task_time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task time read own or admin"
  ON public.task_time_entries;
CREATE POLICY "task time read own or admin"
  ON public.task_time_entries
  FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.sync_task_time_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  transition_at timestamptz := clock_timestamp();
  attributed_user uuid;
BEGIN
  attributed_user := COALESCE(NEW.assignee_id, auth.uid());

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'in_progress' THEN
      INSERT INTO public.task_time_entries (
        task_id,
        task_title,
        task_type,
        workstream,
        project_id,
        user_id,
        started_at
      )
      VALUES (
        NEW.id,
        NEW.title,
        NEW.task_type,
        NEW.workstream,
        NEW.project_id,
        attributed_user,
        transition_at
      )
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  -- Закрываем текущий интервал при выходе из «В работе» или смене атрибуции.
  IF OLD.status = 'in_progress'
     AND (
       NEW.status IS DISTINCT FROM 'in_progress'
       OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.task_type IS DISTINCT FROM OLD.task_type
       OR NEW.workstream IS DISTINCT FROM OLD.workstream
     )
  THEN
    UPDATE public.task_time_entries
    SET ended_at = transition_at
    WHERE task_id = NEW.id
      AND ended_at IS NULL;
  END IF;

  -- Открываем новый интервал при входе/возврате в «В работе».
  IF NEW.status = 'in_progress'
     AND (
       OLD.status IS DISTINCT FROM 'in_progress'
       OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.task_type IS DISTINCT FROM OLD.task_type
       OR NEW.workstream IS DISTINCT FROM OLD.workstream
     )
  THEN
    INSERT INTO public.task_time_entries (
      task_id,
      task_title,
      task_type,
      workstream,
      project_id,
      user_id,
      started_at
    )
    VALUES (
      NEW.id,
      NEW.title,
      NEW.task_type,
      NEW.workstream,
      NEW.project_id,
      attributed_user,
      transition_at
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_task_time_entry_after_change
  ON public.tasks;
CREATE TRIGGER sync_task_time_entry_after_change
AFTER INSERT OR UPDATE OF
  status,
  assignee_id,
  project_id,
  title,
  task_type,
  workstream
ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_time_entry();

-- Историю до миграции не угадываем: для уже активных задач отсчёт начинается сейчас.
INSERT INTO public.task_time_entries (
  task_id,
  task_title,
  task_type,
  workstream,
  project_id,
  user_id,
  started_at
)
SELECT
  task.id,
  task.title,
  task.task_type,
  task.workstream,
  task.project_id,
  task.assignee_id,
  clock_timestamp()
FROM public.tasks AS task
WHERE task.status = 'in_progress'
ON CONFLICT DO NOTHING;
