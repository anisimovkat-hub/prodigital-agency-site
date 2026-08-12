-- Выполненные задачи доступны во вкладке «Сделано» три дня после завершения,
-- затем полностью удаляются. Незавершённые и отменённые задачи не затрагиваются.

-- Защита для старых строк, созданных до триггера completed_at.
UPDATE public.tasks
SET completed_at = COALESCE(created_at, now())
WHERE status = 'done'
  AND completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.cleanup_completed_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.tasks AS task
  WHERE task.status = 'done'
    AND task.completed_at < now() - interval '3 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_completed_tasks() FROM PUBLIC;

-- Оставляем ровно одну ежедневную задачу очистки.
DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'agency-os-delete-completed-tasks'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'agency-os-delete-completed-tasks',
  '17 3 * * *',
  $$SELECT public.cleanup_completed_tasks();$$
);

-- Применяем новое правило сразу, а не ждём следующего запуска cron.
SELECT public.cleanup_completed_tasks();
