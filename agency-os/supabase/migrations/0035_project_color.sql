-- Пользовательский цвет проекта для аналитики и карточек. NULL = стабильный цвет по названию.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS brand_color text;
