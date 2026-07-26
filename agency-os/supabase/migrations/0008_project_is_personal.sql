-- Agency OS: пометка «личный проект»
-- Раздел «Личное» показывает только личные дела (задачи без проекта) и задачи
-- проектов, помеченных как личные (напр. «Личный бренд»: сайт, соцсети, посты).
-- Клиентские проекты сюда не попадают, даже если владелец в них ответственный.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false;

UPDATE public.projects SET is_personal = true WHERE name = 'Личный бренд';
