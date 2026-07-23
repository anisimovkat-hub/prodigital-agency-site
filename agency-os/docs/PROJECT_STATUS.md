# Статус проекта Agency OS

Обновлено: 2026-07-23 (сессии Claude Code и Codex)

## Реализовано и работает на проде

- **Инфраструктура**: Supabase-проект `ihsjgzzdihjesblkuylz` (eu-central-1, free) со схемами
  0001+0002+0003; Vercel-проект `agency-os` (prod: https://agency-os-lilac-eight.vercel.app,
  production deployment `dpl_Sur3FPrZzixiATNAKniPJqVW7eyF`, Ready).
  **Vercel привязан к GitHub** (2026-07-23): Production Branch =
  `claude/agency-ops-mvp-design-ykrrn0`, Root Directory = `agency-os` — пуш в ветку деплоится
  автоматически, инлайн-деплои больше не нужны. CI (lint+test+build) в `.github/workflows/ci.yml`.
- **Auth**: вход по email/паролю; админ — anisimov.katerina@gmail.com (роль owner). Регистрация
  работает только по одноразовому инвайт-коду; неверный код отклоняется триггером.
- **Страницы**: Дашборд (сводные карточки + KPI-таблица), Сегодня, Неделя (группировка по дням,
  сумма оценок времени), Доска (Trello-стиль: цвет по приоритету, аватары, колонка «На паузе»,
  фильтры по проекту/исполнителю), Задачи (фильтры, drawer, создание, поле «Оценка, ч»), Личное,
  Проекты (+создание, KPI-форма, заметки), Клиенты (+создание), Сотрудники (+инвайты),
  Login и Signup.
- **Реальные данные в базе**: 21+3 клиента, 31 проект (июльский список
  со скриншота + ответственные из Notion), 13 задач с чеклистом, 6 профилей
  (Катерина=owner; Инна, Илона, Екатерина, Софа, Алёна=specialist). Пяти специалистам назначены
  временные пароли; email подтверждены.

## Завершено 2026-07-23

1. Через SQL Editor подтверждено, что 0002 уже применена: существуют `invite_codes`,
   `is_admin()`, signup-триггер и ролевые политики. Колонка `tasks.estimate_minutes` из 0003
   также уже присутствует; повторный ALTER не потребовался.
2. Коммит `f7aec61` задеплоен полным репозиторием в production через допустимый Vercel CLI
   fallback. Сборка Next.js 16 прошла на Vercel; deployment
   `dpl_Sur3FPrZzixiATNAKniPJqVW7eyF`, alias — основной production-домен.
3. Production QA: «Проекты» показывает 31 проект; «Доска» показывает 13 задач
   (5 «К выполнению», 6 «В работе», 2 «На паузе»), фильтр по проекту «Озимо» оставляет
   2 задачи. «Неделя» читает `estimate_minutes` без ошибок, дашборд показывает новые сводки.
4. Auth QA: публичная `/signup` доступна; неверный инвайт отклонён, тестовый auth-user не создан.
   Триггер `on_auth_user_created` и policy `member reads own projects` активны, старая широкая
   policy `authenticated full access` для проектов отсутствует. Ранее выполненная проверка
   валидного инвайта и входа специалиста остаётся актуальной — auth/RLS-код не менялся.
5. В Supabase Dashboard подтверждено: Site URL уже равен корню production-домена, redirect
   `https://agency-os-lilac-eight.vercel.app/**` добавлен, Confirm email выключен.
6. Vercel привязан к GitHub: Production Branch =
   `claude/agency-ops-mvp-design-ykrrn0`, Root Directory = `agency-os`.
7. Чат-ассистент внутри приложения отменён: изменения вносятся через Claude Code / Codex
   по запросу владельца без отдельного платного Anthropic API.
8. Таблица «Сегодня»: стандартный порядок начинается с «Проект», затем «Задача»; «Клиент»
   удалён. По всем столбцам доступна сортировка, порядок меняется drag-and-drop и сохраняется
   в текущем браузере. Логика сортировки покрыта unit-тестами.

## Завершено 2026-07-19

1. Миграция `0002_roles_and_invites.sql` применена. Проверены таблица `invite_codes`, триггер
   `on_auth_user_created`, функции `is_admin()`/`is_project_member()`, политика чтения проектов и
   отсутствие старой политики `authenticated full access` — все шесть проверок успешны.
2. Коммит `ce2538e` задеплоен полным каталогом в production. Vercel MCP в сессии был недоступен,
   поэтому использован Vercel CLI с теми же project/team ID. В Vercel добавлены production env
   `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Прод проверен: `/signup` отдаёт 200 и форму с инвайт-кодом; «Проекты» показывает реальные
   строки; «Доска» показывает 11 задач (5 «К выполнению», 6 «В работе»).
4. Поведенческий QA: неверный инвайт отклонён; валидный одноразовый инвайт создал профиль
   `specialist` и пометился использованным. Тестовый пользователь/профиль/инвайт после проверки
   удалены. Инна успешно вошла временным паролем; RLS вернул только 4 назначенных ей проекта и
   0 инвайтов.
5. Пяти сотрудникам назначены уникальные временные пароли. Значения переданы владельцу в чате и
   намеренно не сохранены в Git.
6. Добавлены `docs/ONBOARDING.md` и `docs/PROJECT_MEMORY.md`.

## Ручные шаги владельца в Supabase Dashboard

По Site URL / Redirect URLs / Confirm email действий больше нет. На 2026-07-23 установлено:

- Site URL: `https://agency-os-lilac-eight.vercel.app`;
- Redirect URLs содержат `/login` и `https://agency-os-lilac-eight.vercel.app/**`;
- Authentication → Sign In / Providers → **Confirm email** выключен.

## Запланировано дальше (по приоритету)

1. Заменить email-заглушки сотрудников на реальные адреса (SQL по auth.users+profiles),
   когда владелец пришлёт список.
2. Наполнение: назначить ответственных 5 проектам без владельца (Дядя Ваня, Капельницы,
   Сад на Бали, CSS // Лондон); KPI-данные реальных проектов.
3. Заполнить дедлайны и оценки времени реальных задач, чтобы «Неделя» показывала загрузку.
4. Смена пароля в UI (сейчас только через Supabase Dashboard).
5. Уведомления (телеграм?) о дедлайнах — идея, не подтверждена.

## Известные баги и техдолг

- `lib/supabase/types.ts` ручной — может разъехаться со схемой; сверять при миграциях.
- При CLI fallback 2026-07-23 ошибочно создан пустой Vercel-проект `repo`
  (`prj_eFA1pFa2Qv8B6OdnCZLHaN0mLAEg`). Он не обслуживает Agency OS; удалить после явного
  подтверждения владельца. Целевой `agency-os` и его production alias не затронуты.
- seed.mjs остался от демо-этапа: не запускать на проде (перезальёт демо-данные).
- Email'ы сотрудников — заглушки `*@prodigital.team`; заменить на реальные при выдаче доступов.
- В UI пока нет смены пароля; временные пароли нужно передавать сотрудникам лично.
- `npm ci` сообщает о 2 moderate vulnerabilities; нужен отдельный безопасный dependency audit,
  не применять `npm audit fix --force` автоматически.
- Supabase free: БД паузится после ~7 дней без запросов (будит кнопка Restore в дашборде).
- Vercel Hobby формально некоммерческий; при росте — Pro ($20/мес) или свой хостинг.

## Учётные данные и идентификаторы

- Supabase: проект `ihsjgzzdihjesblkuylz`, org `kbtyanwnrnwozsorlsuz`, URL
  https://ihsjgzzdihjesblkuylz.supabase.co (publishable key хранится как production env Vercel;
  URL и ключ публичные по дизайну).
- Vercel: team `team_htNZrI5iP6zK3F0CurE1R8S3`, проект `prj_OsyQpD1tegxeQuqhO8KQHZUCz64n`.
- Админ: anisimov.katerina@gmail.com (врем. пароль передан владельцу в чате, просили сменить).
