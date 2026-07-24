-- Дата выполнения всегда синхронизирована со статусом задачи.
CREATE OR REPLACE FUNCTION public.sync_task_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSIF NEW.status IS DISTINCT FROM 'done' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_task_completed_at ON public.tasks;
CREATE TRIGGER sync_task_completed_at
  BEFORE UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_task_completed_at();

-- Старые выполненные задачи могли появиться до заполнения completed_at.
UPDATE public.tasks
SET completed_at = COALESCE(created_at, now())
WHERE status = 'done' AND completed_at IS NULL;

-- Выполненные задачи видны в интерфейсе 30 дней, хранятся в архиве ещё 30 дней,
-- затем удаляются вместе с зависимыми чеклистами, комментариями и вложениями.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

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
  $cleanup$
    DELETE FROM public.tasks
    WHERE status = 'done'
      AND completed_at < now() - interval '60 days';
  $cleanup$
);
