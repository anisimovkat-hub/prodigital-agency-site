-- Agency OS: режим ведения проекта и доход/мес (шаг к оценке окупаемости)
-- ownership_mode — как ведётся проект: self (веду сама), launching (на запуске),
--   testing (тест/под вопросом), one_off (разовый), needs_owner (нужен ответственный).
--   Помогает не смешивать «намеренно без сотрудника» и «реально бесхозный».
-- monthly_fee — доход агентства с проекта в месяц (₽). Основа для будущего
--   расчёта ₽/час, когда добавим учёт времени (Этап 2 дорожной карты).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS ownership_mode text,
  ADD COLUMN IF NOT EXISTS monthly_fee numeric;
