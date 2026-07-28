-- Реклама: справочник кастомных конверсий Meta.
-- В insights.actions кастомная конверсия приходит как
-- action_type = 'offsite_conversion.custom.<conversion_id>' — без человекочитаемого
-- имени. Настоящее имя берём из Graph API /act_<id>/customconversions (id,name) и
-- кладём сюда, чтобы UI показывал «Заявка с лендинга» вместо «Своя конверсия 12345…».
-- Обновляется при каждой синхронизации. Доступ: только владелец (is_admin).

CREATE TABLE IF NOT EXISTS public.ad_custom_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  conversion_id text NOT NULL,
  name text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (account_id, conversion_id)
);
CREATE INDEX IF NOT EXISTS ad_custom_conversions_conversion_id_idx
  ON public.ad_custom_conversions (conversion_id);

ALTER TABLE public.ad_custom_conversions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_custom_conversions admin" ON public.ad_custom_conversions;
CREATE POLICY "ad_custom_conversions admin" ON public.ad_custom_conversions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
