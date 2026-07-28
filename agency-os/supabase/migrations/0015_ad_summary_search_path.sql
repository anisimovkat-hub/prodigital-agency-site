-- Закрепляем search_path у ad_campaign_period_summary (линтер Supabase
-- function_search_path_mutable). Все объекты внутри функции уже указаны с схемой,
-- поэтому пустой search_path безопасен. Права не меняются: функция остаётся
-- SECURITY INVOKER, доступ по-прежнему решает RLS рекламных таблиц.

ALTER FUNCTION public.ad_campaign_period_summary(date, date)
  SET search_path = '';
