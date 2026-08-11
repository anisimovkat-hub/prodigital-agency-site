-- "На запуске" — отдельная стадия проекта с повышенным вниманием.
-- "Отменена" сохраняет историю задачи, но исключает её из активной работы.
ALTER TYPE public.project_stage ADD VALUE IF NOT EXISTS 'launching';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'cancelled';
