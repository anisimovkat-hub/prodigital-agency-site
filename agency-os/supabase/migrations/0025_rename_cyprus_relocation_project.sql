-- «Кипр релокация» — проект агентства «Манифест».
-- Проверки не позволяют случайно переименовать или перепривязать другой проект.
DO $$
DECLARE
  manifest_client_id uuid;
  updated_count integer;
BEGIN
  SELECT id
  INTO manifest_client_id
  FROM public.clients
  WHERE lower(trim(name)) = lower('Манифест');

  IF manifest_client_id IS NULL THEN
    RAISE EXCEPTION 'Клиент «Манифест» не найден: проект не изменён';
  END IF;

  UPDATE public.projects
  SET
    name = 'Запасной аэродром — Кипр',
    client_id = manifest_client_id
  WHERE regexp_replace(lower(name), '[[:space:]-]+', '', 'g') = 'кипррелокация';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> 1 THEN
    RAISE EXCEPTION 'Ожидался один проект «Кипр релокация», найдено: %', updated_count;
  END IF;
END;
$$;
