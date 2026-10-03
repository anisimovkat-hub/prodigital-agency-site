-- Optional goal performance per Meta audience breakdown. NULL means the API did
-- not provide the metric; zero means it provided a measured zero.
ALTER TABLE public.ad_audience_metrics
  ADD COLUMN IF NOT EXISTS spend numeric,
  ADD COLUMN IF NOT EXISTS conversion_actions jsonb;
