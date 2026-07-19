# Agency OS — заметка-память

Обновлено: 2026-07-19

- Репозиторий: `anisimovkat-hub/prodigital-agency-site`, каталог `agency-os/`, ветка
  `claude/agency-ops-mvp-design-ykrrn0`.
- Прод: https://agency-os-lilac-eight.vercel.app.
- Supabase project: `ihsjgzzdihjesblkuylz`; Vercel project: `prj_OsyQpD1tegxeQuqhO8KQHZUCz64n`;
  team: `team_htNZrI5iP6zK3F0CurE1R8S3`.
- Миграции 0001 и 0002 применены. Роли, RLS, одноразовые инвайты и signup-триггер проверены.
- Код `ce2538e` задеплоен в production как `dpl_Heau2u7KpTi8sBZYX4seQqbXMNoM`.
- «Проекты» и «Доска» показывают реальные данные; `/signup` доступен.
- Пять специалистов получили временные пароли, email подтверждены. Пароли находятся только у
  владельца и не сохраняются в репозитории.
- QA доступа: Инна видит только 4 собственных проекта и не видит инвайты. Валидный/невалидный
  signup проверен, тестовые записи удалены.
- Vercel не связан с GitHub. Деплоить полным каталогом через MCP; fallback — Vercel CLI с теми же
  ID. Production env Supabase находятся в Vercel Project Settings.
- Ручной шаг владельца: заменить Site URL с `.../login` на корень production-домена, добавить
  redirect `/**` и решить, отключать ли Confirm email. Сейчас Confirm email включён.
- Следующие задачи: реальные email сотрудников, UI смены пароля, ответственные для проектов без
  владельца, KPI, фильтры канбана, dependency audit.
