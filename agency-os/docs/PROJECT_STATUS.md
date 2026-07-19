# Статус проекта Agency OS

Обновлено: 2026-07-19 (сессия Claude Code)

## Реализовано и работает на проде

- **Инфраструктура**: Supabase-проект `ihsjgzzdihjesblkuylz` (eu-central-1, free) со схемой 0001;
  Vercel-проект `agency-os` (prod: https://agency-os-lilac-eight.vercel.app, деплой файлами через MCP,
  git к Vercel НЕ привязан). CI (lint+test+build) в `.github/workflows/ci.yml`.
- **Auth**: вход по email/паролю; админ — anisimov.katerina@gmail.com (роль owner).
- **Страницы**: Дашборд (KPI+статистика задач по проектам), Сегодня, Задачи (фильтры, drawer,
  создание), Проекты (+создание, KPI-форма, заметки), Клиенты (+создание), Сотрудники (загрузка).
- **Реальные данные в базе** (заведены в этой сессии): 21+3 клиента, 31 проект (июльский список
  со скриншота + ответственные из Notion), 13 задач с чеклистом, 6 профилей
  (Катерина=owner; Инна, Илона, Екатерина, Софа, Алёна=specialist, входа пока не имеют).

## Готово в коде, НО НЕ ЗАДЕПЛОЕНО и НЕ ПРИМЕНЕНО (точка продолжения!)

Всё собрано и протестировано локально (24/24 теста, lint, build — зелёные), закоммичено в ветку
`claude/agency-ops-mvp-design-ykrrn0`. Осталось сделать по шагам:

1. **Применить миграцию `supabase/migrations/0002_roles_and_invites.sql`** через
   `mcp__Supabase__apply_migration` (project_id `ihsjgzzdihjesblkuylz`). Она включает ролевой RLS
   (owner видит всё, specialist — только свои проекты), таблицу invite_codes и триггер регистрации.
   До применения все залогиненные видят всё (сейчас логин есть только у владельца — не страшно).
2. **Задеплоить код на Vercel** через `mcp__Vercel__deploy_to_vercel` (target=production,
   name=agency-os, teamId=team_htNZrI5iP6zK3F0CurE1R8S3). Деплой — полным набором файлов inline
   (как в прошлый раз; см. DECISIONS.md). В деплой добавились: /board, /personal, /signup,
   invite-форма, фикс embed-хинтов, фикс today-sort.
   ВАЖНО: без этого деплоя на проде страница «Проекты» ПУСТАЯ (баг неоднозначного embed).
3. **Выдать пароли сотрудникам**: после применения 0002 задать 5 сотрудникам временные пароли
   через SQL (`extensions.crypt('пароль', extensions.gen_salt('bf'))` в auth.users) и передать
   владельцу; ИЛИ удалить их auth-записи и позвать через инвайт-коды (но на них завязаны
   responsible_id проектов — проще пароли).
4. **Ручные шаги владельца в Supabase Dashboard** (сказать ей): Authentication → URL Configuration →
   Site URL = https://agency-os-lilac-eight.vercel.app; желательно Authentication → Providers →
   Email → отключить «Confirm email» (инвайт-код уже фильтрует посторонних) — иначе регистрация
   требует письма-подтверждения.
5. Написать `docs/ONBOARDING.md` — инструкция сотруднику (ссылка на /signup + код от админа).

## Запланировано дальше (по приоритету)

1. Привязать GitHub-репозиторий к Vercel (Root Directory=agency-os) — руками владельца, чтобы
   пуши деплоились сами; добавить env-переменные в Vercel UI.
2. Наполнение: назначить ответственных 5 проектам без владельца (Дядя Ваня, Капельницы,
   Сад на Бали, CSS // Лондон); KPI-данные реальных проектов.
3. Канбан: фильтр по проекту/исполнителю; колонка «paused».
4. Смена пароля в UI (сейчас только через Supabase Dashboard).
5. Уведомления (телеграм?) о дедлайнах — идея, не подтверждена.

## Известные баги и техдолг

- Прод (до деплоя из п.2 выше): «Проекты» пустые — PGRST201 ambiguous embed; фикс уже в коде
  (`profiles!projects_responsible_id_fkey`).
- `лib/supabase/types.ts` ручной — может разъехаться со схемой; сверять при миграциях.
- Vercel-деплой не связан с git: код в GitHub и код на проде синхронизируются только вручную.
- seed.mjs остался от демо-этапа: не запускать на проде (перезальёт демо-данные).
- Email'ы сотрудников — заглушки `*@prodigital.team`; заменить на реальные при выдаче доступов.
- Supabase free: БД паузится после ~7 дней без запросов (будит кнопка Restore в дашборде).
- Vercel Hobby формально некоммерческий; при росте — Pro ($20/мес) или свой хостинг.

## Учётные данные и идентификаторы

- Supabase: проект `ihsjgzzdihjesblkuylz`, org `kbtyanwnrnwozsorlsuz`, URL
  https://ihsjgzzdihjesblkuylz.supabase.co (anon key — в .env.local, в Vercel зашит в .env.production
  внутри деплоя; оба публичные по дизайну).
- Vercel: team `team_htNZrI5iP6zK3F0CurE1R8S3`, проект `prj_OsyQpD1tegxeQuqhO8KQHZUCz64n`.
- Админ: anisimov.katerina@gmail.com (врем. пароль передан владельцу в чате, просили сменить).
