# Agency OS — заметка-память

Обновлено: 2026-07-23

- Репозиторий: `anisimovkat-hub/prodigital-agency-site`, каталог `agency-os/`, ветка
  `claude/agency-ops-mvp-design-ykrrn0`.
- Прод: https://agency-os-lilac-eight.vercel.app.
- Supabase project: `ihsjgzzdihjesblkuylz`; Vercel project: `prj_OsyQpD1tegxeQuqhO8KQHZUCz64n`;
  team: `team_htNZrI5iP6zK3F0CurE1R8S3`.
- Миграции 0001–0003 применены. Роли, RLS, одноразовые инвайты, signup-триггер и
  `tasks.estimate_minutes` подтверждены SQL-проверкой.
- Код `f7aec61` задеплоен в production как `dpl_Sur3FPrZzixiATNAKniPJqVW7eyF`.
- «Проекты» показывают 31 проект; «Доска» — 13 задач с фильтрами и колонкой «На паузе»;
  «Неделя» и новые сводки дашборда работают; `/signup` доступен.
- В таблице «Сегодня» проект стоит первым, задача — второй; столбец «Клиент» удалён. Все
  столбцы сортируются, их порядок меняется перетаскиванием и сохраняется в браузере.
- Задачи редактируются в общей боковой панели из таблицы и канбана: основные поля, описание,
  чеклист, комментарии и ссылки. Цветные плашки проектов стабильны между всеми страницами.
- Пять специалистов получили временные пароли, email подтверждены. Пароли находятся только у
  владельца и не сохраняются в репозитории.
- QA доступа: Инна видит только 4 собственных проекта и не видит инвайты. Валидный/невалидный
  signup проверен, тестовые записи удалены.
- Vercel связан с GitHub: Production Branch = `claude/agency-ops-mvp-design-ykrrn0`,
  Root Directory = `agency-os`; `main` для production не используется. Production env Supabase
  находятся в Vercel Project Settings.
- Supabase Auth настроен: Site URL — корень production-домена, redirect `/**` добавлен,
  Confirm email выключен. Ручных шагов по этим настройкам нет.
- Следующие задачи: реальные email сотрудников, UI смены пароля, ответственные для проектов без
  владельца, KPI, заполнение дедлайнов/оценок, dependency audit.
- Случайно созданный пустой Vercel-проект `repo` (`prj_eFA1pFa2Qv8B6OdnCZLHaN0mLAEg`)
  не связан с production Agency OS; удалить после явного подтверждения владельца.
