-- Ключи рекламных кабинетов (Telegram Ads, ВК, Яндекс.Директ), подключаемые из интерфейса.
-- Сам ключ хранится только в зашифрованном Supabase Vault. Таблица хранит ссылку на секрет
-- и состояние загрузки; читать и записывать секреты может только серверная роль.

CREATE TABLE public.ad_account_credentials (
  ad_account_id uuid PRIMARY KEY REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  secret_id uuid NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sync_at timestamptz,
  last_error text
);

ALTER TABLE public.ad_account_credentials ENABLE ROW LEVEL SECURITY;
-- Политик для authenticated/anon нет: состояние читается на сервере после проверки доступа.
REVOKE ALL ON public.ad_account_credentials FROM anon, authenticated;

-- Создаёт или заменяет секрет кабинета в Vault.
CREATE OR REPLACE FUNCTION public.save_ad_account_secret(p_account_id uuid, p_secret text, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  SELECT secret_id INTO v_secret_id FROM public.ad_account_credentials WHERE ad_account_id = p_account_id;
  IF v_secret_id IS NULL THEN
    v_secret_id := vault.create_secret(p_secret, 'ad_account:' || p_account_id::text, 'Ключ рекламного кабинета Agency OS');
    INSERT INTO public.ad_account_credentials (ad_account_id, secret_id, created_by)
    VALUES (p_account_id, v_secret_id, p_user_id);
  ELSE
    PERFORM vault.update_secret(v_secret_id, p_secret);
    UPDATE public.ad_account_credentials SET last_error = NULL WHERE ad_account_id = p_account_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.read_ad_account_secret(p_account_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.decrypted_secret
  FROM public.ad_account_credentials c
  JOIN vault.decrypted_secrets s ON s.id = c.secret_id
  WHERE c.ad_account_id = p_account_id;
$$;

-- Удаление кабинета из интерфейса убирает и секрет.
CREATE OR REPLACE FUNCTION public.delete_ad_account_secret(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  DELETE FROM public.ad_account_credentials WHERE ad_account_id = p_account_id RETURNING secret_id INTO v_secret_id;
  IF v_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_secret_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_ad_account_secret(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_ad_account_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_ad_account_secret(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_ad_account_secret(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_ad_account_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_ad_account_secret(uuid) TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_account_credentials TO service_role;
