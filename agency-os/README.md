# Agency OS

Внутренняя система управления агентством: дашборд руководителя, задачи на сегодня,
проекты, клиенты, сотрудники, KPI.

## Стек

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS v4 + компоненты в стиле shadcn/ui (`src/components/ui`)
- Supabase (Postgres + Auth) через `@supabase/ssr`

## Запуск локально

1. Скопируйте `.env.local.example` в `.env.local` и подставьте свои значения
   из Supabase Dashboard → Project Settings → API:

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

2. Установите зависимости и запустите dev-сервер:

   ```bash
   npm install
   npm run dev
   ```

3. Откройте http://localhost:3000 — без логина вас перебросит на `/login`.

## Авторизация

Публичной регистрации нет. Пользователей создаёте вручную в Supabase Dashboard →
Authentication → Users, затем добавляете соответствующую строку в таблицу
`profiles` (см. следующий шаг — SQL-миграцию).

## Деплой на Vercel

Если этот проект живёт в подпапке монорепозитория — при подключении репозитория
в Vercel укажите Root Directory = `agency-os`, и добавьте переменные окружения
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` в настройках проекта.
