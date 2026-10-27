-- Read-only production preflight. No migration DDL, repair or replay.
BEGIN READ ONLY;
DO $verify$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.projects'::regclass AND attname='aliases' AND NOT attisdropped AND atttypid='text[]'::regtype) THEN RAISE EXCEPTION 'Missing projects.aliases'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attname='aliases' AND NOT attisdropped AND atttypid='text[]'::regtype) THEN RAISE EXCEPTION 'Missing profiles.aliases'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.tasks'::regclass AND attname='owner_approval_pending' AND NOT attisdropped AND atttypid='boolean'::regtype) THEN RAISE EXCEPTION 'Missing tasks.owner_approval_pending'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.telegram_task_drafts'::regclass AND attname='expires_at' AND NOT attisdropped AND atttypid='timestamp with time zone'::regtype) THEN RAISE EXCEPTION 'Missing telegram_task_drafts.expires_at'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.telegram_task_intakes'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'Missing RLS on telegram_task_intakes'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.telegram_voice_queue'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'Missing RLS on telegram_voice_queue'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.telegram_intake_messages'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'Missing RLS on telegram_intake_messages'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.tasks'::regclass AND polname='unapproved intake stays with owner' AND NOT polpermissive) THEN RAISE EXCEPTION 'Missing private draft policy'; END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='expire-telegram-intake-drafts' AND schedule='* * * * *' AND active AND command='SELECT public.expire_telegram_intake_drafts();') THEN RAISE EXCEPTION 'Missing expiry schedule'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='can_access_task' AND md5(btrim(p.prosrc,E' \n\r\t'))='be8dbaca48d9916c11b6124f45a96df4') THEN RAISE EXCEPTION 'Function drift: can_access_task'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='commit_telegram_intake_item' AND md5(btrim(p.prosrc,E' \n\r\t'))='ec45a436152e7f3b34a2fb761e6a33c6') THEN RAISE EXCEPTION 'Function drift: commit_telegram_intake_item'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='cancel_telegram_task_draft' AND md5(btrim(p.prosrc,E' \n\r\t'))='c31fd8b64315f8c47b535d8faa1504de') THEN RAISE EXCEPTION 'Function drift: cancel_telegram_task_draft'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='complete_telegram_task_delivery' AND md5(btrim(p.prosrc,E' \n\r\t'))='40925a7d70ca95bc22e1ffc66f7c09ca') THEN RAISE EXCEPTION 'Function drift: complete_telegram_task_delivery'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='expire_telegram_intake_drafts' AND md5(btrim(p.prosrc,E' \n\r\t'))='b8135198d79f6d6bfec886937a8ca9d4') THEN RAISE EXCEPTION 'Function drift: expire_telegram_intake_drafts'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='start_telegram_task_intake' AND md5(btrim(p.prosrc,E' \n\r\t'))='bc423c923bc4102459ce9594d1a1970f') THEN RAISE EXCEPTION 'Function drift: start_telegram_task_intake'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='apply_telegram_intake_reply' AND md5(btrim(p.prosrc,E' \n\r\t'))='4dec3c009d9781051066f1d76829b4c6') THEN RAISE EXCEPTION 'Function drift: apply_telegram_intake_reply'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='claim_telegram_task_delivery' AND md5(btrim(p.prosrc,E' \n\r\t'))='a5154719567498ce312130e93ffa4174') THEN RAISE EXCEPTION 'Function drift: claim_telegram_task_delivery'; END IF;
END;
$verify$;
DO $history$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='0049' AND name='telegram_text_task_intake' AND md5(array_to_string(statements,E'\n'))='bd5994c474a1a215d3278ec441e32264') THEN RAISE EXCEPTION 'Migration source/history mismatch: 0049'; END IF;
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='0050' AND name='telegram_intake_message_receipts' AND md5(array_to_string(statements,E'\n'))='af8140819c9f088358ea5972d42ff48f') THEN RAISE EXCEPTION 'Migration source/history mismatch: 0050'; END IF;
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='0051' AND name='telegram_intake_delivery_locks' AND md5(array_to_string(statements,E'\n'))='b6c3847461dd7bd85794150a34a67edc') THEN RAISE EXCEPTION 'Migration source/history mismatch: 0051'; END IF;
  IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261027045143' AND name='kpi_targets_and_alerts') OR to_regclass('public.project_kpi_targets') IS NULL OR to_regclass('public.kpi_alerts') IS NULL THEN RAISE EXCEPTION 'KPI migration missing'; END IF;
END;
$history$;
SELECT version,name FROM supabase_migrations.schema_migrations WHERE version IN ('0049','0050','0051','20261027045143') ORDER BY version;
COMMIT;
