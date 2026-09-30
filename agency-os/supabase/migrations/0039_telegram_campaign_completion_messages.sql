-- Direct, one-time Telegram handoffs for campaign/application completion dates.
CREATE TABLE public.telegram_scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  client_label text NOT NULL,
  application_number integer NOT NULL CHECK (application_number > 0),
  campaign_name text NOT NULL,
  scheduled_for date NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  sent_message_id bigint,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_profile_id, scheduled_for, application_number)
);

CREATE INDEX telegram_scheduled_messages_due_idx
  ON public.telegram_scheduled_messages (scheduled_for, status);

ALTER TABLE public.telegram_scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages telegram scheduled messages"
  ON public.telegram_scheduled_messages
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- These are direct messages to Екатерина Швецова's bound work chat at 08:00
-- Europe/Moscow on the date each mos.ru application is switched off.
DO $$
DECLARE
  ekaterina_id uuid;
BEGIN
  SELECT id INTO ekaterina_id
  FROM public.profiles
  WHERE full_name ILIKE '%екатерина%швецова%'
    AND is_active = true
  ORDER BY full_name
  LIMIT 1;

  IF ekaterina_id IS NULL THEN
    RAISE EXCEPTION 'Active profile Екатерина Швецова was not found';
  END IF;

  INSERT INTO public.telegram_scheduled_messages
    (recipient_profile_id, client_label, application_number, campaign_name, scheduled_for)
  VALUES
    (ekaterina_id, 'mos.ru', 4, 'онлайн-консультации', '2026-10-15'),
    (ekaterina_id, 'mos.ru', 1, 'узнай москву', '2026-10-22'),
    (ekaterina_id, 'mos.ru', 6, 'карта москвича', '2026-11-01'),
    (ekaterina_id, 'mos.ru', 5, 'портал потребителя', '2026-11-15'),
    (ekaterina_id, 'mos.ru', 7, 'мосхаб', '2026-11-20'),
    (ekaterina_id, 'mos.ru', 8, 'мой id', '2026-11-06'),
    (ekaterina_id, 'mos.ru', 9, 'моя москва', '2026-11-15'),
    (ekaterina_id, 'mos.ru', 10, 'портал поставщиков', '2026-11-30'),
    (ekaterina_id, 'mos.ru', 11, 'узнай москву', '2026-11-30')
  ON CONFLICT (recipient_profile_id, scheduled_for, application_number)
  DO UPDATE SET
    client_label = EXCLUDED.client_label,
    campaign_name = EXCLUDED.campaign_name,
    status = CASE
      WHEN public.telegram_scheduled_messages.status = 'sent' THEN 'sent'
      ELSE 'pending'
    END,
    last_error = NULL,
    updated_at = now();
END;
$$;
