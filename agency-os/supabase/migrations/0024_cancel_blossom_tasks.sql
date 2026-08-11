-- По решению владельца проект Blossom не запускается: отменяем только незавершённые задачи.
-- История задач и уже выполненные задачи сохраняются.
UPDATE public.tasks
SET status = 'cancelled'
WHERE project_id IN (
  SELECT id
  FROM public.projects
  WHERE lower(trim(name)) = lower('Blossom')
)
  AND status NOT IN ('done', 'cancelled');
