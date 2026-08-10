-- Личные выполненные задачи с дедлайном удаляются через два календарных дня.
-- Незавершённые задачи и выполненные задачи без дедлайна сохраняются.
-- Для остальных проектов остаётся общий срок хранения 60 дней после выполнения.

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
    AND (
      (
        task.due_date IS NOT NULL
        AND task.due_date <= current_date - 2
        AND (
          task.project_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = task.project_id
              AND project.is_personal = true
          )
        )
      )
      OR task.completed_at < now() - interval '60 days'
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_completed_tasks() FROM PUBLIC;

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

-- Сразу очищаем уже накопившиеся выполненные личные задачи по тому же правилу.
SELECT public.cleanup_completed_tasks();
