-- Фокус-таймер больше не используется. Удаляем UI-поддержку из БД, не затрагивая
-- обычный автоматический учёт времени по task_time_entries и статус ai_wait.

DROP TRIGGER IF EXISTS close_focus_after_task_state_change ON public.tasks;
DROP FUNCTION IF EXISTS public.close_focus_after_task_state();
DROP FUNCTION IF EXISTS public.start_task_focus(uuid);
DROP FUNCTION IF EXISTS public.stop_task_focus(text);
DROP FUNCTION IF EXISTS public.set_task_ai_wait(uuid);
DROP TABLE IF EXISTS public.focus_sessions;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS current_focus_task_id;
