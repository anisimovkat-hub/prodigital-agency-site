-- Only when rolling production back to a pre-intake build.
-- Cancel undelivered new intake tasks, preserving every row and all legacy tasks.
-- In-flight Telegram sends are left intact to finish safely; inspect their count.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $rollback$
DECLARE item record;
BEGIN
  FOR item IN SELECT t.id FROM public.tasks t
    WHERE t.owner_approval_pending
      AND NOT EXISTS(SELECT 1 FROM public.telegram_task_drafts d WHERE d.task_id=t.id AND d.status='sending')
    ORDER BY t.id FOR UPDATE
  LOOP
    UPDATE public.tasks SET status='cancelled' WHERE id=item.id AND owner_approval_pending AND status NOT IN ('done','cancelled');
    UPDATE public.telegram_task_drafts SET status='cancelled',updated_at=now()
      WHERE task_id=item.id AND status IN ('pending_approval','editing','failed');
  END LOOP;
  UPDATE public.telegram_task_intakes SET status='cancelled',updated_at=now() WHERE status='pending';
END;
$rollback$;
COMMIT;
SELECT count(*) AS intake_sends_still_in_flight
FROM public.telegram_task_drafts d JOIN public.tasks t ON t.id=d.task_id
WHERE t.owner_approval_pending AND d.status='sending';
