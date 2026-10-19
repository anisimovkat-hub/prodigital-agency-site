-- A direction can be pinned to one advertiser account. Campaigns without a
-- CounterIds setting are included only when explicitly allowed by configuration.
ALTER TABLE public.telegram_weekly_status_directions
  ADD COLUMN ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  ADD COLUMN include_counterless_campaigns boolean NOT NULL DEFAULT false;

ALTER TABLE public.telegram_weekly_status_scenarios
  ADD COLUMN display_title text,
  ADD COLUMN show_direction_heading boolean NOT NULL DEFAULT true,
  ADD COLUMN spend_label text NOT NULL DEFAULT 'Расход с НДС',
  ADD COLUMN recipient_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.telegram_weekly_status_scenarios
  ALTER COLUMN recipient_chat_id DROP NOT NULL,
  ADD CONSTRAINT weekly_status_has_recipient
    CHECK (recipient_profile_id IS NOT NULL OR nullif(recipient_chat_id, '') IS NOT NULL);

CREATE INDEX telegram_weekly_status_directions_account_idx
  ON public.telegram_weekly_status_directions(ad_account_id)
  WHERE ad_account_id IS NOT NULL;
