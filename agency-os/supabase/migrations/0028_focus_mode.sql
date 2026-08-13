-- Agency OS: точный фокус поверх грубого автоматического учёта task_time_entries.
-- Одна открытая focus_session = одна задача, которой человек уделяет внимание сейчас.

ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'ai_wait';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_focus_task_id uuid
  REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  task_title text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ended_at timestamptz,
  stop_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT focus_sessions_valid_interval
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS focus_sessions_one_open_per_user
  ON public.focus_sessions(user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS focus_sessions_task_started_idx
  ON public.focus_sessions(task_id, started_at DESC);
CREATE INDEX IF NOT EXISTS focus_sessions_user_started_idx
  ON public.focus_sessions(user_id, started_at DESC);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "focus sessions read own or admin" ON public.focus_sessions;
CREATE POLICY "focus sessions read own or admin"
  ON public.focus_sessions FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.start_task_focus(p_task_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Блокировка профиля сериализует два одновременных старта одного человека.
  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.tasks task
    WHERE task.id = p_task_id
      AND public.can_access_task(task.id)
      AND (
        task.assignee_id = v_user_id
        OR (task.assignee_id IS NULL AND task.creator_id = v_user_id)
      )
      AND task.status NOT IN ('done', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Task is unavailable for focus';
  END IF;

  UPDATE public.focus_sessions
  SET ended_at = clock_timestamp(), stop_reason = 'switched'
  WHERE user_id = v_user_id AND ended_at IS NULL;

  UPDATE public.tasks
  SET status = 'in_progress'
  WHERE id = p_task_id AND status IS DISTINCT FROM 'in_progress';

  INSERT INTO public.focus_sessions(user_id, task_id, task_title, project_id)
  SELECT v_user_id, task.id, task.title, task.project_id
  FROM public.tasks task
  WHERE task.id = p_task_id
  RETURNING id INTO v_session_id;

  UPDATE public.profiles
  SET current_focus_task_id = p_task_id
  WHERE id = v_user_id;

  RETURN v_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stop_task_focus(p_reason text DEFAULT 'stopped')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;

  UPDATE public.focus_sessions
  SET ended_at = clock_timestamp(), stop_reason = COALESCE(NULLIF(p_reason, ''), 'stopped')
  WHERE user_id = v_user_id AND ended_at IS NULL;

  UPDATE public.profiles SET current_focus_task_id = NULL WHERE id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_task_ai_wait(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL OR NOT public.can_access_task(p_task_id) THEN
    RAISE EXCEPTION 'Task is unavailable';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;

  UPDATE public.focus_sessions
  SET ended_at = clock_timestamp(), stop_reason = 'ai_wait'
  WHERE user_id = v_user_id AND task_id = p_task_id AND ended_at IS NULL;

  UPDATE public.profiles
  SET current_focus_task_id = NULL
  WHERE id = v_user_id AND current_focus_task_id = p_task_id;

  UPDATE public.tasks SET status = 'ai_wait' WHERE id = p_task_id;
END;
$$;

-- Любое завершение/ожидание/пауза задачи закрывает точный человеческий фокус.
CREATE OR REPLACE FUNCTION public.close_focus_after_task_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'in_progress' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    UPDATE public.focus_sessions
    SET ended_at = clock_timestamp(), stop_reason =
      CASE WHEN NEW.status = 'ai_wait' THEN 'ai_wait' ELSE 'task_state_changed' END
    WHERE task_id = NEW.id AND ended_at IS NULL;

    UPDATE public.profiles
    SET current_focus_task_id = NULL
    WHERE current_focus_task_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS close_focus_after_task_state_change ON public.tasks;
CREATE TRIGGER close_focus_after_task_state_change
AFTER UPDATE OF status, assignee_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.close_focus_after_task_state();

-- Приостановленный проект останавливает и задачи, переданные ИИ.
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
    UPDATE public.tasks
    SET status = 'paused'
    WHERE project_id = NEW.id
      AND status IN ('backlog', 'todo', 'in_progress', 'ai_wait', 'review');

    UPDATE public.recurring_tasks
    SET is_active = false
    WHERE project_id = NEW.id
      AND is_active;
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_task_focus(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_task_focus(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_task_ai_wait(uuid) TO authenticated;
