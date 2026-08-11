-- Agency OS: стадия проекта управляет его текущей работой.
-- Пауза/завершение останавливают открытые задачи и шаблоны повторов.

CREATE OR REPLACE FUNCTION public.pause_project_work_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.stage IN ('paused', 'finished')
     AND (TG_OP = 'INSERT' OR NEW.stage IS DISTINCT FROM OLD.stage)
  THEN
    -- Смена статуса задачи также закрывает открытый автоинтервал времени
    -- через существующий trigger sync_task_time_entry_after_change.
    UPDATE public.tasks
    SET status = 'paused'
    WHERE project_id = NEW.id
      AND status IN ('backlog', 'todo', 'in_progress', 'review');

    UPDATE public.recurring_tasks
    SET is_active = false
    WHERE project_id = NEW.id
      AND is_active;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pause_project_work_after_stage_change
  ON public.projects;
CREATE TRIGGER pause_project_work_after_stage_change
AFTER INSERT OR UPDATE OF stage
ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.pause_project_work_on_stage_change();

-- Исправляем уже приостановленные/завершённые проекты при применении миграции.
UPDATE public.tasks AS task
SET status = 'paused'
FROM public.projects AS project
WHERE task.project_id = project.id
  AND project.stage IN ('paused', 'finished')
  AND task.status IN ('backlog', 'todo', 'in_progress', 'review');

UPDATE public.recurring_tasks AS recurring
SET is_active = false
FROM public.projects AS project
WHERE recurring.project_id = project.id
  AND project.stage IN ('paused', 'finished')
  AND recurring.is_active;

-- Даже если шаблон включили в обход UI, генератор не создаёт задачи для
-- приостановленного или завершённого проекта. Личные повторы без проекта работают.
CREATE OR REPLACE FUNCTION public.generate_recurring_tasks(target date DEFAULT current_date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.recurring_tasks%ROWTYPE;
  cnt integer := 0;
  due_today boolean;
BEGIN
  FOR r IN
    SELECT recurring.*
    FROM public.recurring_tasks AS recurring
    LEFT JOIN public.projects AS project ON project.id = recurring.project_id
    WHERE recurring.is_active
      AND (
        recurring.project_id IS NULL
        OR project.stage IN ('active', 'launching')
      )
  LOOP
    due_today :=
      (r.frequency = 'daily')
      OR (r.frequency = 'every_other_day' AND ((target - r.anchor_date) % 2) = 0)
      OR (
        r.frequency = 'weekly'
        AND r.weekdays IS NOT NULL
        AND EXTRACT(DOW FROM target)::smallint = ANY (r.weekdays)
      );

    IF due_today AND NOT EXISTS (
      SELECT 1
      FROM public.tasks
      WHERE recurring_task_id = r.id
        AND due_date = target
    ) THEN
      INSERT INTO public.tasks (
        title,
        project_id,
        workstream,
        assignee_id,
        creator_id,
        task_type,
        priority,
        due_date,
        recurring_task_id,
        status
      )
      VALUES (
        r.title,
        r.project_id,
        r.workstream,
        r.assignee_id,
        r.creator_id,
        r.task_type,
        r.priority,
        target,
        r.id,
        'todo'
      );
      cnt := cnt + 1;
    END IF;
  END LOOP;

  RETURN cnt;
END;
$$;
