-- Agency OS: направления работ внутри проекта + подзадачи

-- Направление работ (workstream) — метка внутри проекта: «Сайт», «Таргет» и т.п.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workstream text;

-- Подзадачи: задача может быть дочерней к другой задаче
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS tasks_parent_task_id_idx ON public.tasks (parent_task_id);

-- Доступ к подзадачам обеспечивается существующими политиками tasks:
-- подзадача наследует project_id родителя (проставляется при создании), поэтому
-- can_access_task / is_project_member работают без изменений RLS.
