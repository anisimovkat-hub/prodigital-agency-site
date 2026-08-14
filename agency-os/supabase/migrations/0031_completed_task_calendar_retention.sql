-- «Сделано» хранит задачу до конца двух следующих календарных дат.
-- На третью календарную дату после завершения задача удаляется, независимо
-- от точного часа завершения. Операционный часовой пояс Agency OS — Bangkok.

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
    AND task.completed_at IS NOT NULL
    AND (task.completed_at AT TIME ZONE 'Asia/Bangkok')::date
      <= (now() AT TIME ZONE 'Asia/Bangkok')::date - 3;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_completed_tasks() FROM PUBLIC;

-- Сразу применяем исправленное календарное правило. Ежедневная cron-job из
-- 0027 продолжает вызывать эту функцию по прежнему расписанию.
SELECT public.cleanup_completed_tasks();
