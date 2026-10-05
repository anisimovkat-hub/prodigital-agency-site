-- Результат последней загрузки кабинета: отличает «ошибка загрузки» от
-- «реклама выключена» и «нет результатов за период».
ALTER TABLE public.ad_accounts ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;
ALTER TABLE public.ad_accounts ADD COLUMN IF NOT EXISTS last_sync_error text;
