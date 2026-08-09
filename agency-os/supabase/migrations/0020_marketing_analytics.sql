-- Единая маркетинговая аналитика: органика соцсетей + публичные клиентские отчёты.
-- Meta-токен остаётся только в sensitive env Vercel. В таблицах храним исключительно
-- идентификаторы аккаунтов и уже полученные агрегированные метрики.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS logo_url text;

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('instagram', 'vk', 'telegram')),
  external_id text NOT NULL,
  username text,
  name text,
  profile_picture_url text,
  followers_count bigint NOT NULL DEFAULT 0 CHECK (followers_count >= 0),
  media_count bigint NOT NULL DEFAULT 0 CHECK (media_count >= 0),
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

CREATE INDEX IF NOT EXISTS social_accounts_project_idx
  ON public.social_accounts (project_id);

CREATE TABLE IF NOT EXISTS public.social_account_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  date date NOT NULL,
  reach bigint NOT NULL DEFAULT 0 CHECK (reach >= 0),
  impressions bigint NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  profile_views bigint NOT NULL DEFAULT 0 CHECK (profile_views >= 0),
  engagements bigint NOT NULL DEFAULT 0 CHECK (engagements >= 0),
  accounts_engaged bigint NOT NULL DEFAULT 0 CHECK (accounts_engaged >= 0),
  follower_count bigint NOT NULL DEFAULT 0 CHECK (follower_count >= 0),
  follower_growth bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (social_account_id, date)
);

CREATE INDEX IF NOT EXISTS social_account_metrics_account_date_idx
  ON public.social_account_metrics (social_account_id, date DESC);

CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  caption text,
  media_type text,
  media_url text,
  thumbnail_url text,
  permalink text,
  published_at timestamptz NOT NULL,
  reach bigint NOT NULL DEFAULT 0 CHECK (reach >= 0),
  impressions bigint NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  views bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
  likes bigint NOT NULL DEFAULT 0 CHECK (likes >= 0),
  comments bigint NOT NULL DEFAULT 0 CHECK (comments >= 0),
  saved bigint NOT NULL DEFAULT 0 CHECK (saved >= 0),
  shares bigint NOT NULL DEFAULT 0 CHECK (shares >= 0),
  engagements bigint NOT NULL DEFAULT 0 CHECK (engagements >= 0),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (social_account_id, external_id)
);

CREATE INDEX IF NOT EXISTS social_posts_account_published_idx
  ON public.social_posts (social_account_id, published_at DESC);

CREATE TABLE IF NOT EXISTS public.client_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  public_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  title text,
  is_active boolean NOT NULL DEFAULT true,
  show_organic boolean NOT NULL DEFAULT true,
  show_ads boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_account_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_accounts admin" ON public.social_accounts;
CREATE POLICY "social_accounts admin" ON public.social_accounts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "social_account_metrics admin" ON public.social_account_metrics;
CREATE POLICY "social_account_metrics admin" ON public.social_account_metrics
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "social_posts admin" ON public.social_posts;
CREATE POLICY "social_posts admin" ON public.social_posts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "client_reports admin" ON public.client_reports;
CREATE POLICY "client_reports admin" ON public.client_reports
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Публичная страница не получает прямого SELECT к внутренним таблицам. Она видит только
-- агрегированный JSON одного проекта после проверки секретного uuid из URL.
CREATE OR REPLACE FUNCTION public.client_report_payload(
  p_token uuid,
  p_since date,
  p_until date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH report AS (
    SELECT r.*, p.name AS project_name, p.logo_url
    FROM public.client_reports r
    JOIN public.projects p ON p.id = r.project_id
    WHERE r.public_token = p_token
      AND r.is_active
    LIMIT 1
  ),
  organic_daily AS (
    SELECT
      m.date,
      sum(m.reach)::bigint AS reach,
      sum(m.impressions)::bigint AS impressions,
      sum(m.engagements)::bigint AS engagements,
      sum(m.follower_growth)::bigint AS follower_growth
    FROM public.social_account_metrics m
    JOIN public.social_accounts a ON a.id = m.social_account_id
    JOIN report r ON r.project_id = a.project_id AND r.show_organic
    WHERE m.date BETWEEN p_since AND p_until
    GROUP BY m.date
  ),
  organic_total AS (
    SELECT
      coalesce(sum(reach), 0)::bigint AS reach,
      coalesce(sum(impressions), 0)::bigint AS impressions,
      coalesce(sum(engagements), 0)::bigint AS engagements,
      coalesce(sum(follower_growth), 0)::bigint AS follower_growth
    FROM organic_daily
  ),
  organic_account AS (
    SELECT a.platform, a.username, a.name, a.profile_picture_url,
           a.followers_count, a.media_count, a.last_synced_at
    FROM public.social_accounts a
    JOIN report r ON r.project_id = a.project_id AND r.show_organic
    WHERE a.is_active
    ORDER BY a.last_synced_at DESC NULLS LAST
    LIMIT 1
  ),
  top_posts AS (
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.reach DESC), '[]'::jsonb) AS items
    FROM (
      SELECT p.caption, p.media_type, p.media_url, p.thumbnail_url, p.permalink,
             p.published_at, p.reach, p.views, p.likes, p.comments, p.saved,
             p.shares, p.engagements
      FROM public.social_posts p
      JOIN public.social_accounts a ON a.id = p.social_account_id
      JOIN report r ON r.project_id = a.project_id AND r.show_organic
      WHERE p.published_at::date BETWEEN p_since AND p_until
      ORDER BY p.reach DESC, p.engagements DESC
      LIMIT 6
    ) x
  ),
  post_total AS (
    SELECT count(*)::bigint AS publications, coalesce(sum(p.saved), 0)::bigint AS saves
    FROM public.social_posts p
    JOIN public.social_accounts a ON a.id = p.social_account_id
    JOIN report r ON r.project_id = a.project_id AND r.show_organic
    WHERE p.published_at::date BETWEEN p_since AND p_until
  ),
  paid_daily AS (
    SELECT
      m.date,
      sum(m.spend)::numeric AS spend,
      sum(m.impressions)::bigint AS impressions,
      sum(m.clicks)::bigint AS clicks,
      sum(m.reach)::bigint AS reach
    FROM public.ad_campaign_metrics m
    JOIN public.ad_campaigns c ON c.id = m.campaign_id
    JOIN report r ON r.project_id = c.project_id AND r.show_ads
    WHERE m.date BETWEEN p_since AND p_until
    GROUP BY m.date
  ),
  preferred_conversion AS (
    SELECT DISTINCT ON (c.id, v.date)
      c.id AS campaign_id, v.date, v.count, v.value
    FROM public.ad_conversions v
    JOIN public.ad_campaigns c ON c.id = v.campaign_id
    JOIN report r ON r.project_id = c.project_id AND r.show_ads
    WHERE v.date BETWEEN p_since AND p_until
      AND v.count > 0
      AND (
        v.action_type IN (
          'lead', 'onsite_web_lead', 'onsite_conversion.lead_grouped',
          'offsite_conversion.fb_pixel_lead', 'leadgen.other',
          'onsite_conversion.messaging_conversation_started_7d',
          'purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase',
          'complete_registration', 'submit_application', 'schedule', 'contact'
        )
        OR v.action_type LIKE 'offsite_conversion.custom.%'
      )
    ORDER BY c.id, v.date,
      CASE v.action_type
        WHEN 'lead' THEN 1
        WHEN 'onsite_web_lead' THEN 2
        WHEN 'onsite_conversion.lead_grouped' THEN 3
        WHEN 'offsite_conversion.fb_pixel_lead' THEN 4
        WHEN 'leadgen.other' THEN 5
        ELSE 50
      END,
      v.count DESC
  ),
  paid_total AS (
    SELECT
      coalesce(sum(d.spend), 0)::numeric AS spend,
      coalesce(sum(d.impressions), 0)::bigint AS impressions,
      coalesce(sum(d.clicks), 0)::bigint AS clicks,
      coalesce(sum(d.reach), 0)::bigint AS reach,
      coalesce((SELECT sum(count) FROM preferred_conversion), 0)::numeric AS conversions,
      coalesce((SELECT sum(value) FROM preferred_conversion), 0)::numeric AS conversion_value
    FROM paid_daily d
  ),
  currencies AS (
    SELECT coalesce(jsonb_agg(x.currency ORDER BY x.currency), '[]'::jsonb) AS items
    FROM (
      SELECT DISTINCT a.currency
      FROM public.ad_accounts a
      JOIN public.ad_campaigns c ON c.ad_account_id = a.id
      JOIN report r ON r.project_id = c.project_id AND r.show_ads
      WHERE a.currency IS NOT NULL
    ) x
  )
  SELECT jsonb_build_object(
    'project', jsonb_build_object(
      'id', r.project_id,
      'name', r.project_name,
      'logo_url', coalesce(r.logo_url, oa.profile_picture_url),
      'title', coalesce(r.title, r.project_name),
      'show_organic', r.show_organic,
      'show_ads', r.show_ads
    ),
    'organic', jsonb_build_object(
      'totals', to_jsonb(ot),
      'account', to_jsonb(oa),
      'post_totals', to_jsonb(pst),
      'daily', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.date) FROM organic_daily d), '[]'::jsonb),
      'posts', tp.items
    ),
    'paid', jsonb_build_object(
      'totals', to_jsonb(pt),
      'daily', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.date) FROM paid_daily d), '[]'::jsonb),
      'currencies', cur.items
    ),
    'period', jsonb_build_object('from', p_since, 'to', p_until)
  )
  FROM report r
  CROSS JOIN organic_total ot
  LEFT JOIN organic_account oa ON true
  CROSS JOIN top_posts tp
  CROSS JOIN post_total pst
  CROSS JOIN paid_total pt
  CROSS JOIN currencies cur;
$$;

REVOKE ALL ON FUNCTION public.client_report_payload(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_report_payload(uuid, date, date) TO anon, authenticated;
