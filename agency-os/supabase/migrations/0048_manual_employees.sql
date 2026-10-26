-- Task accounting must not require an authentication account or an invitation.
-- Keep the original auth FK for registered profiles on a separate nullable link.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id);

UPDATE public.profiles SET auth_user_id = id
 WHERE NOT is_manual AND auth_user_id IS NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_user_id_unique
  ON public.profiles(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_manual_name_unique
  ON public.profiles(lower(btrim(full_name)))
  WHERE is_manual AND coalesce(is_active, true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_auth_link_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_auth_link_check CHECK (
      (is_manual AND auth_user_id IS NULL AND role <> 'owner') OR
      (NOT is_manual AND auth_user_id IS NOT NULL AND auth_user_id = id)
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_profile_auth_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.is_manual THEN
    IF NEW.auth_user_id IS NOT NULL OR EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Карточка для учёта не может быть учётной записью';
    END IF;
  ELSE
    -- Existing signup trigger inserts id = auth user id. Preserve that contract.
    IF NEW.auth_user_id IS NULL THEN NEW.auth_user_id := NEW.id; END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_profile_auth_link() FROM PUBLIC;
DROP TRIGGER IF EXISTS enforce_profile_auth_link ON public.profiles;
CREATE TRIGGER enforce_profile_auth_link
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_auth_link();

-- Existing owner-only INSERT policy and all task/project RLS remain unchanged.
-- No auth.users row, password, email, identity or invitation is created here.
COMMIT;
