# Ad Analytics — план полноценного модуля рекламной аналитики

Цель: превратить пилот (account-level статистика Meta) в полноценный аналитический
модуль внутри Agency OS: гибкие периоды, срез по проектам/кабинетам/кампаниям, разные
цели у разных кампаний, несколько пикселей, и верхняя панель «проблемные моменты».

Это большой модуль — вести поэтапно (Фазы A–D ниже), каждая фаза = рабочий, задеплоенный
инкремент.

## Что уже есть (пилот, НЕ переделывать без нужды)

- Миграции: `0011_ad_metrics.sql` (ad_accounts + ad_metrics, RLS admin-only),
  `0012_ad_account_currency.sql` (ad_accounts.currency).
- `src/lib/meta-ads.ts` — Graph API `v23.0`: `fetchMetaAccounts()` (/me/adaccounts,
  fields account_id,name,currency), `fetchMetaInsights(actId, since, until)`
  (level=account, time_increment=1, парсит spend/impressions/clicks + leads из actions).
  Токен ТОЛЬКО из `process.env.META_ACCESS_TOKEN` (sensitive env Vercel, в БД/Git нет).
- `src/app/(dashboard)/ads/actions.ts` — `syncMetaAds()`: кабинеты → upsert ad_accounts →
  авто-привязка к проекту по имени → суточные метрики 30д в ad_metrics.
- `src/app/(dashboard)/ads/page.tsx` — раздел «Реклама» (owner-only): таблица кабинетов
  (расход/лиды/CPL 30д + валюта) + кнопка «Обновить статистику Меты».
- Кабинеты↔проекты: 8 Meta-кабинетов уже привязаны (см. таблицу ad_accounts).

## Требования владельца (цель модуля)

1. **Гибкие периоды**: выбор диапазона дат, гранулярность день/неделя/месяц.
2. **Срез по проекту**: выбрать один проект (или кабинет/кампанию) и смотреть только его.
3. **Разные цели у разных кампаний**: где-то лиды, где-то сообщения, покупки и т.д.
   В одном кабинете — несколько кампаний / продуктов / целей / пикселей.
4. **Верхняя панель «Требует внимания»**: аномалии и проблемные моменты
   (рост CPL/CPA, падение показов, ноль конверсий, слив/недокрут бюджета).
5. Позже: пересчёт валют в ₽ (кабинеты в USD/EUR/IDR/…); Яндекс.Директ тем же механизмом.

## Модель данных (расширение)

- `ad_campaigns` (id, ad_account_id FK, external_id, name, objective, status,
  project_id nullable, created_at, unique(ad_account_id, external_id)).
- Метрики на уровне кампании: расширить/дополнить `ad_metrics` полем `campaign_id`
  (nullable — account-level остаётся) ЛИБО отдельная `ad_campaign_metrics`. Хранить
  spend/impressions/clicks/reach по (campaign_id, date).
- **Конверсии по целям** (ключевое для «разные цели/пиксели»): гибкая таблица
  `ad_conversions` (id, campaign_id FK, date, action_type text, count numeric,
  value numeric, unique(campaign_id, date, action_type)). Сюда кладём ВСЕ action_type
  из Meta insights `actions` (lead, messaging, purchase, pixel-specific, и т.д.) —
  не схлопывая в один «leads». UI потом решает, какая цель «главная» для кампании/проекта.
- Опц.: `project_primary_goal` — какая цель считается основной для проекта (для CPL/CPA
  на дашборде). Можно поле на projects или на ad_campaigns.
- FX: `fx_rates` (currency, date, rate_to_rub) — для пересчёта в ₽ (Фаза D).

types.ts ведётся ВРУЧНУЮ — при каждой новой таблице/колонке дополнять.

## Загрузка (ingestion)

- Meta insights на уровне кампаний: `/act_<id>/insights?level=campaign&time_increment=1
  &fields=campaign_id,campaign_name,spend,impressions,clicks,actions,action_values
  &time_range={since,until}`. Пагинация по paging.next.
- Из `actions` писать КАЖДЫЙ action_type в `ad_conversions` (не только «lead»).
- Кампании upsert в `ad_campaigns` (наследуют project_id кабинета по умолчанию; можно
  переопределять вручную — у одного кабинета кампании могут относиться к разным продуктам).
- Идемпотентность через onConflict (как в пилоте).
- Историческая догрузка: параметризовать since/until (не только 30д).

## UI (раздел «Реклама» → аналитика)

- Панель фильтров: диапазон дат, гранулярность (день/неделя/месяц), проект (+ кабинет,
  + кампания как drill-down), выбор цели/действия.
- Графики временных рядов: расход, конверсии по выбранной цели, CPA/CPL, CTR. Понадобится
  библиотека графиков (напр. `recharts`) — добавить в deps; следить за bundle. Либо лёгкий
  SVG. Учитывать react-hooks/purity (Date.now() — только внутри функций, не в теле render).
- Таблица кампаний с метриками за период; сортировка.
- Верхняя панель «Требует внимания»: сравнение текущего периода с предыдущим →
  флаги (CPL ↑ >X%, показы ↓ >X%, 0 конверсий при расходе > 0, расход к бюджету).
  Пороговые правила — таблица `ad_alert_rules` или конфиг.
- Валюта: до Фазы D показывать в валюте кабинета + ярлык валюты (уже есть колонка currency).

## Фазы (поэтапно, каждая — деплой)

- **Фаза A — данные по кампаниям + конверсии по целям.** `ad_campaigns` + `ad_conversions`,
  ingestion на уровне кампаний, запись всех action_type. UI пока минимальный (таблица кампаний
  с расходом и разбивкой по целям за 30д). Это фундамент под всё остальное.
- **Фаза B — аналитический UI.** Фильтры (период, гранулярность, проект/кабинет/кампания,
  цель) + графики временных рядов + таблица за период.
- **Фаза C — панель «Требует внимания».** Правила аномалий period-over-period, вывод сверху.
- **Фаза D — валюты в ₽ + Яндекс.Директ.** `fx_rates` + пересчёт для сопоставимого CPA;
  затем адаптер Яндекс.Директа (свой OAuth/токен в env) в те же таблицы.

## Ограничения и правила проекта (важно соблюдать)

- **Деплой** = push в ветку `claude/agency-ops-mvp-design-ykrrn0` (Vercel автосборка).
  Перед push: `tsc --noEmit`, `eslint`, `vitest run`, `next build` — всё зелёное.
- **Репозиторий общий с Codex** — перед работой `git fetch` + свериться; коммитить ТОЛЬКО
  свои файлы, не сметать чужие незакоммиченные правки `git add -A`.
- **Токены** (Meta, Яндекс) — только в sensitive env Vercel; в код/БД/Git не класть.
  Модель не вводит и не запрашивает токены в открытом виде.
- **RLS**: рекламные таблицы — admin-only (`is_admin()`), как в 0011.
- Supabase проект `ihsjgzzdihjesblkuylz`; раздел «Реклама» owner-only.
- Русский UI; формы = client `*-form.tsx` + `actions.ts`; enum-подписи в `lib/labels.ts`.
