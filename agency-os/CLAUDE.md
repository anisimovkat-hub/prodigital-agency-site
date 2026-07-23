@AGENTS.md

# Agency OS

Внутренняя операционная система рекламного агентства ProDigital (Катерина Анисимова):
дашборд руководителя, проекты/клиенты/сотрудники, задачи (таблица + канбан + «Сегодня» + личные),
KPI с авторасчётом, заметки. Заменяет связку Notion + Trello + таблицы. Пользователи — владелец
(админ, видит всё) и ~5 специалистов (видят только свои проекты).

**Продакшн на 2026-07-23:** миграции 0001–0003 применены, роли/RLS и инвайты работают;
коммит `f7aec61` задеплоен в production (`dpl_Sur3FPrZzixiATNAKniPJqVW7eyF`). Страницы
«Проекты», «Доска», «Неделя» и дашборд проверены на реальных данных. Пять сотрудников ранее
получили временные пароли; пароли в Git не хранятся и при деплоях не перевыпускаются.

## Стек

- Next.js 16 (App Router, Turbopack), React 19, TypeScript strict
- Tailwind CSS v4, компоненты в стиле shadcn/ui (`src/components/ui`), lucide-react
- Supabase: Postgres + Auth через `@supabase/ssr` (проект `ihsjgzzdihjesblkuylz`, eu-central-1, free-тир)
- Zod v4 — валидация форм в server actions
- Vitest — юнит-тесты; ESLint 9
- Деплой: Vercel (team `team_htNZrI5iP6zK3F0CurE1R8S3`, проект `agency-os`, prod: agency-os-lilac-eight.vercel.app)
- Production env в Vercel: `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Структура

```
agency-os/
├── docs/
│   ├── ONBOARDING.md            # инструкция сотруднику
│   └── PROJECT_MEMORY.md        # короткая заметка-память для переноса между сессиями
├── supabase/migrations/
│   ├── 0001_init.sql            # схема: profiles, clients, projects, project_members,
│   │                            #   tasks(+checklist/comments/attachments), kpi_entries, project_notes
│   ├── 0002_roles_and_invites.sql  # ролевой RLS, invite_codes, триггер регистрации
│   └── 0003_task_estimate.sql      # оценка задач в минутах
├── scripts/seed.mjs             # демо-сидинг (не для прода)
├── src/
│   ├── proxy.ts                 # Next 16: замена middleware.ts (авторизация всех роутов)
│   ├── app/
│   │   ├── login/  signup/      # публичные страницы (signup — по инвайт-коду)
│   │   └── (dashboard)/         # всё под auth: layout с Sidebar
│   │       ├── page.tsx         # дашборд руководителя (KPI+задачи по проектам)
│   │       ├── today/           # срочное + сортировка/перетаскивание столбцов
│   │       ├── week/            # задачи текущей недели + оценки времени
│   │       ├── board/           # канбан с фильтрами (HTML5 dnd + useOptimistic)
│   │       ├── tasks/           # таблица+фильтры, task-drawer, task-form, actions.ts
│   │       ├── personal/        # личные задачи (project_id IS NULL)
│   │       ├── projects/ [id]/  # + kpi-form, notes-tabs, project-form
│   │       ├── clients/ [id]/   # + client-form
│   │       └── employees/ [id]/ # + invite-form (только для owner)
│   ├── components/              # badges, filter-*, sidebar (адаптивный), ui/*
│   └── lib/
│       ├── supabase/            # server.ts, client.ts, proxy.ts(updateSession), types.ts (ручные типы БД!)
│       ├── validation.ts        # все zod-схемы
│       ├── labels.ts            # русские названия enum'ов
│       └── format.ts, today-sort.ts, utils.ts
```

## Архитектурные решения

- **Server Actions вместо API-роутов** — вся запись в БД через `"use server"` + `useActionState`,
  ошибки валидации возвращаются полем `errors: Record<string,string[]>`.
- **RLS как единственный слой прав** (0002): SECURITY DEFINER функции `is_admin()`,
  `is_project_member(pid)`, `can_access_task(tid)`, `has_profile()` — без рекурсии политик.
  UI не фильтрует по ролям (кроме скрытия admin-блоков) — база сама отдаёт только доступное.
- **Регистрация только по инвайт-кодам**: триггер `on_auth_user_created` на `auth.users`
  валидирует `raw_user_meta_data->>'invite_code'`, создаёт профиль с ролью из кода.
  Пользователи без метаданных (созданные админом через SQL) пропускаются триггером.
- **Личные задачи** = `tasks.project_id IS NULL` + creator/assignee = auth.uid().
- **Оценка задач хранится в минутах** (`estimate_minutes`), а формы принимают часы и округляют
  `часы × 60`. Форматирование длительности централизовано в `lib/format.ts`.
- **PostgREST embed с хинтом**: `profiles!projects_responsible_id_fkey` обязателен —
  без него связь projects→profiles неоднозначна (вторая — через project_members) и запрос падает.
- **types.ts ведётся вручную** по миграциям (новая таблица → добавить в types.ts).
- **`src/proxy.ts`** — в Next 16 так называется middleware; matcher покрыт тестом proxy.test.ts.
- **Автодеплой из рабочей ветки** — Vercel подключён к GitHub: Production Branch =
  `claude/agency-ops-mvp-design-ykrrn0`, Root Directory = `agency-os`. Ручной fallback через
  Vercel MCP/CLI должен использовать тот же project/team ID. Production env хранится в
  настройках проекта Vercel, секреты и временные пароли в Git не попадают.

## Соглашения

- Русский язык во всём UI и в комментариях к SQL; названия файлов/переменных — английские.
- Формы: клиентский компонент `*-form.tsx` + action в соседнем `actions.ts`; инлайн-ошибки под полем.
- Списки: компоненты `Table*` из ui/table; пустое состояние — `TableEmpty`.
- Enum-подписи — только через `lib/labels.ts`; значения enum — константы в `lib/validation.ts`.
- Функции сортировки/логики — в `lib/` с юнит-тестами (vitest, `*.test.ts` рядом).
- Прежде чем писать код — см. AGENTS.md: у этого Next.js есть breaking changes, сверяться с
  `node_modules/next/dist/docs/`.
