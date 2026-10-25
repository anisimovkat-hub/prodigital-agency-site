# Team Trip — отдельный Meta export, 2026-10-25

## Состояние

Серверный маршрут реализован и прошёл TypeScript, ESLint, 381 тест /52 файла и
production Webpack build. Активация Google-записи и расписания пока не подтверждена.
Не менять этот статус на «работает» только по успешному deployment или unit-тестам.

Публикация идёт в существующий Vercel project `agency-os`,
`prj_OsyQpD1tegxeQuqhO8KQHZUCz64n`, scope `katerina-anisimova`, из ветки
`claude/agency-ops-mvp-design-ykrrn0`. Старый scope в исторических записях устарел.
Пользовательские незакоммиченные изменения аналитики и два локальных Telegram-коммита
основной копии не включены: использована отдельная чистая копия origin `2169bbb`.

## Контракт

`GET https://prodigital-os.vercel.app/api/exports/team-trip-meta?since=YYYY-MM-DD&until=YYYY-MM-DD`

- `Authorization: Bearer TEAM_TRIP_SHEETS_SECRET`. Секрет минимум 32 байта,
  отдельный от Meta, Talent Press и cron. Значение только в sensitive Vercel
  Production и закрытых Script Properties; не в исходниках, ячейках или чате.
- Единственный кабинет `1018564883119850`; параметров выбора кабинета/URL/полей нет.
- Неделя Пн–Вс с началом в 2026 году, завершённая по Москве. Не текущая неделя.
- Используется существующий `META_ACCESS_TOKEN`, Graph API v23.0 — без извлечения,
  копирования или ротации токена. Никакого discovery других рекламодателей.
- Дневные Insights `level=ad` и независимо `level=account`, `time_increment=1`,
  `action_report_time=impression`, `use_unified_attribution_setting=true`.
- Полная пагинация (до 80 страниц на уровень) через cursor `after` на фиксированном
  Graph host. `paging.next` не используется и не передаётся клиенту.
- Ответ: `schemaVersion=1`, `source=meta_live`, `generatedAt`, `period`, `account`,
  `details[]`, `controlRows[]`; `Cache-Control: no-store`. Только whitelist полей.
- Account metadata включает валюту и timezone. Apps Script отдельно требует
  согласованного Moscow timezone. USD/EUR/RUB не конвертируются на сервере.
- Spend, impressions и link clicks сверяются с account control. Дубли ad/day,
  control/day, действий; неполные поля; чужие даты/валюта/кабинет отменяют ответ.
  Отсутствующие actions остаются неизвестными, а не нулевыми лидами/переписками.
- Ошибочный/отсутствующий ключ: 401 без Meta-запроса. Период/лишние параметры: 400.
  Сбой Meta/контроля: 502 с безопасным кодом, без сырых ошибок/URL. HEAD/OPTIONS: 405.

Нет DB-записи, миграции, изменения RLS, прежнего Meta sync или маршрутов других проектов.
Исключение из session-proxy точечное, только для этого защищённого маршрута.

## Google-проект и безопасное включение

Подготовлен отдельный закрытый Apps Script:
https://script.google.com/home/projects/1G5f5ghCKGVrbGR5Do5M_bnIegMmGVLoc50WmULnFPNg-c7qzXGhCoLBr/edit

Он предназначен только для существующей вкладки `Недельный отчет 2026` (gid 810558571)
файла Team Trip. Клиентский код и инструкции находятся в проектной папке владельца
`scripts/meta-weekly-report`, версия `2026-10-25.2`, 17 offline-проверок.
Запись по умолчанию выключена. Порядок:

1. Один новый закрытый ключ записать в Vercel и `TT_META_EXPORT_KEY`, не в чат.
2. Опубликовать route; проверить 401/400/405 и полный живой ответ одного периода.
3. В Apps Script подтвердить разрешения Google и выполнить `testMetaConnection`.
4. Задать подтверждённые курс/коэффициент `TT_META_FX_JSON` и явные неоднозначные
   tour/goal/action overrides. Не переносить прежние 80 RUB/USD и 1.2 вслепую.
5. Выполнить `previewMetaWeek` без записи; подтвердить состав строк и контрольные суммы.
6. Только затем разрешить запись, ручной `syncMetaWeek` и проверку сохранности
   Яндекса/ВК/ручных полей. Скрипт архивирует BEFORE/INSIGHT/COMMIT атомарно с записью.
7. После успешной замены отключить старое Codex-задание `team-trip-meta`, затем
   включить понедельничный Google-trigger около 09:00 МСК и email ошибок.

Недельный блок со строками Meta и итогами должен уже существовать; полностью новую
пустую неделю клиентская версия не создаёт. На проверке шаблона последняя неделя
12–18 октября. Месячный отчёт этим скриптом не пересобирается. Ограничения нельзя
скрывать за статусом «автоматизация настроена».

## Проверки

- 35 новых тестов Meta helper/HTTP route и расширение proxy tests; всего 381 тест.
- Whitelist аккаунта, дат, валют; byte-safe Bearer auth, отсутствие ключа/настройки,
  ошибки API, no-store, отсутствующие actions, дубли, cursor-only pagination,
  промежуточная пустая страница и сверка независимых итогов.
- Предыдущие 17 offline-тестов Apps Script не являются доказательством live Meta
  доступа, Google OAuth или работающего расписания.

Источники: [Meta Business SDK](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py),
[официальная коллекция Meta](https://www.postman.com/meta/facebook-marketing-api/request/5wdl62t/attributionsetting).
