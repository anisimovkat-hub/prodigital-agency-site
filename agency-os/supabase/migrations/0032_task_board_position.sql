-- Сохраняемый ручной порядок карточек внутри колонок канбана.
-- NULL означает, что карточка ещё не переставлялась вручную и в ручном режиме
-- получает умную сортировку как безопасный fallback.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS board_position integer;

CREATE INDEX IF NOT EXISTS tasks_status_board_position_idx
  ON public.tasks(status, board_position)
  WHERE board_position IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reorder_board_tasks(
  p_task_ids uuid[],
  p_status public.task_status
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF p_task_ids IS NULL OR cardinality(p_task_ids) = 0 THEN
    RAISE EXCEPTION 'Task order cannot be empty';
  END IF;

  IF (
    SELECT count(DISTINCT task_id)
    FROM unnest(p_task_ids) AS task_id
  ) <> cardinality(p_task_ids) THEN
    RAISE EXCEPTION 'Task order contains duplicates';
  END IF;

  WITH ordered AS (
    SELECT task_id, position
    FROM unnest(p_task_ids) WITH ORDINALITY AS item(task_id, position)
  )
  UPDATE public.tasks AS task
  SET
    status = p_status,
    board_position = ordered.position::integer * 1000
  FROM ordered
  WHERE task.id = ordered.task_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> cardinality(p_task_ids) THEN
    RAISE EXCEPTION 'Not all tasks are available for reordering'
      USING ERRCODE = '42501';
  END IF;

  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_board_tasks(uuid[], public.task_status)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_board_tasks(uuid[], public.task_status)
  TO authenticated;
