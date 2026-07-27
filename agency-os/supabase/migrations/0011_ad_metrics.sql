-- Реклама: кабинеты и суточные метрики (Этап 3 дорожной карты, пилот на Meta)
-- ad_accounts — рекламные кабинеты (act_XXXX), привязанные к проекту CRM.
--   Список подтягивается из токена системного пользователя Meta (/me/adaccounts).
-- ad_metrics — суточные показатели по кабинету (расход/показы/клики/лиды).
--   Загрузка идёт из Graph API insights (time_increment=1). Токен хранится ТОЛЬКО
--   в sensitive env Vercel META_ACCESS_TOKEN, в БД и Git его нет.
-- Доступ: только владелец (is_admin).

CREATE TABLE IF NOT EXISTS public.ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'meta',
  external_id text NOT NULL,
  name text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (platform, external_id)
);

CREATE TABLE IF NOT EXISTS public.ad_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  date date NOT NULL,
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  leads bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (ad_account_id, date)
);
CREATE INDEX IF NOT EXISTS ad_metrics_account_date_idx
  ON public.ad_metrics (ad_account_id, date DESC);

ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_accounts admin" ON public.ad_accounts;
CREATE POLICY "ad_accounts admin" ON public.ad_accounts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "ad_metrics admin" ON public.ad_metrics;
CREATE POLICY "ad_metrics admin" ON public.ad_metrics
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
