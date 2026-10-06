# Design QA — быстрое управление проектами

## Настраиваемые показатели рекламы — 2026-10-06

- Production release: `b99461e`, Vercel agency-os success; authenticated owner.
- Talent Press / сентябрь: расход, количество и отдельная цена лида в одной строке.
  Количество и цена имеют независимые дельты; sampled price reconciles to goal spend/results.
  Денежные KPI пересчитываются USD/RUB без изменения результатов или native-таблицы.
- «Добавить показатель»: базовые checkboxes disabled; CPM/показы сохраняются после
  reload. Закрытие снаружи отменяет неподтверждённый выбор; Escape возвращает фокус.
  «По умолчанию» восстанавливает набор. Дополнительная подписка без своих кампаний
  показывает количество и объяснение недоступной цены, без фиктивной CPA.
- Единорожки: отдельные пары переписок/покупок; при нуле результатов цена «—».
  Native IDR сохраняет исходные деньги; USD не меняет количество. Настройки разных
  проектов независимы. Обзор и Реклама сохраняют карточки, даты и валюту.
- Телефон390 CSS px: document width390, мобильный диалог в пределах экрана,
  список прокручивается, сохранение и reset доступны, кнопки около44 CSS px.
  CPC добавлен через мобильное окно; после проверки тестовые наборы сброшены.
- Desktop: просмотрены реальные столбцы/линия графиков, три KPI и окно настройки;
  clipping/overlap не обнаружены. Свежая production-консоль без warning/error.
- TypeScript, lint, 315 tests /48files, Webpack production build, diff check passed.
  Storage stores only IDs per user/project; no new dependencies, database or ad writes.
- Скриншоты живых метрик остаются только в локальном временном каталоге/чате,
  не включены в GitHub. Кодовый протокол не содержит production-сумм или чисел лидов.

- Source visual truth:
  - `/var/folders/q_/sn0glqyj0zb8fnvz7dxlsm280000gn/T/TemporaryItems/NSIRD_screencaptureui_mxVY1h/Снимок экрана — 2026-08-10 в 21.01.26.png`
  - `/var/folders/q_/sn0glqyj0zb8fnvz7dxlsm280000gn/T/TemporaryItems/NSIRD_screencaptureui_lhzY6i/Снимок экрана — 2026-08-10 в 21.02.03.png`
- Implementation: `https://agency-os-lilac-eight.vercel.app/projects`
- Implementation screenshots:
  - `/private/tmp/agency-os-projects-quick-controls.png`
  - `/private/tmp/agency-os-project-detail-editor-closed.png`
  - `/private/tmp/agency-os-project-detail-editor-open.png`
  - `/private/tmp/agency-os-project-detail-narrow.png`
- Combined comparison: `/private/tmp/agency-os-projects-qa-comparison.png`
- State: авторизованный owner; список текущих проектов; ВФЛА с закрытым и открытым редактором
- Browser viewport: 1633 × 891 CSS px, devicePixelRatio 1.8; responsive pass — 853 × 800 CSS px
- Source pixels: список 2392 × 1318; карточка 2940 × 1912
- Implementation pixels: 1633 × 891 для каждого desktop-снимка
- Density normalization: оба исходника пропорционально приведены к ширине 1633 px; сравнение
  собрано попарно в одном изображении. У исходной карточки сохранён browser chrome, поэтому
  сравнивались совпадающие области приложения, а не высота окна целиком.

## Full-view comparison evidence

- Табличная структура, ширины смысловых колонок, типографика и цветовая семантика сохранены.
- Плашки «Статус» и «Стадия» стали немного шире прежних badge, но таблица не переполнилась;
  стрелка нативного select делает возможность изменения понятной без дополнительного текста.
- В карточке проекта прежняя пустая полоса `<details>` удалена: чёрная кнопка расположена
  справа в одной строке с логотипом, названием и состояниями.
- Закрытый редактор не занимает вертикальное место; открытая форма появляется сразу под шапкой.

## Focused region comparison evidence

- На production у каждой строки есть два уникально подписанных combobox-контрола, сохранивших
  зелёные, янтарные, красные и нейтральные состояния.
- Кнопка использует иконку Pencil из lucide-react, видимый текст и чёрную заливку; в открытом
  состоянии меняется на «Закрыть редактор» с иконкой X и `aria-expanded=true`.
- На узком экране 853 px заголовок и кнопка остаются в одной строке, карточки ниже складываются
  в одну колонку; наложений и обрезки главного действия нет.

## Required fidelity surfaces

- Fonts/typography: сохранён Geist, прежняя иерархия заголовка и табличного текста; подписи не
  обрезаны.
- Spacing/layout: строка заголовка стала компактнее; select-плашки выровнены по колонкам,
  редактор раскрывается без скачка соседних элементов в закрытом состоянии.
- Colors/tokens: использованы существующие emerald/amber/red/neutral semantic colors и
  стандартная чёрная primary-кнопка Agency OS.
- Image quality: логотип ВФЛА и проектные логотипы не менялись и сохранили исходное качество.
- Copy/content: «Редактировать проект» и «Закрыть редактор» однозначно описывают действие;
  статусы и стадии используют существующие русские словари.

## Interaction checks

- На проекте «Кипр релокация» production-проверка изменила `health` green → yellow → green и
  `stage` active → paused → active; после перезагрузки подтверждены исходные green/active.
- Реальные данные после теста полностью возвращены в исходное состояние.
- Редактор ВФЛА открыт и закрыт через новую кнопку; форма и все её поля доступны.
- Console warnings/errors: 0.
- TypeScript, ESLint, 124 unit-теста и production build: passed.

## Findings

- P0/P1/P2 расхождений не обнаружено.
- P3: select-плашки шире прежних badge — намеренный компромисс ради понятного клика и нативной
  клавиатурной доступности.

## Comparison history

- Первый production-снимок сразу после push показывал прежние статичные badge; после завершения
  автодеплоя страница перезагружена и повторно захвачена с новыми combobox-контролами.
- Post-deploy сравнение не выявило исправлений уровня P0/P1/P2, поэтому дополнительная
  визуальная итерация не потребовалась.

## Implementation checklist

- [x] Статус и стадия меняются по клику на текущую плашку.
- [x] Сохранение выполняется сразу и сообщает об ошибке видимо и через aria-live.
- [x] Тестовые изменения возвращены в исходное состояние.
- [x] Кнопка редактирования с карандашом расположена справа от названия.
- [x] Открытие/закрытие редактора, desktop, узкий экран и console проверены на production.

final result: passed

---

# Design QA — компактный рекламный отчёт и аудитория Meta

- Source screenshot: `/var/folders/q_/sn0glqyj0zb8fnvz7dxlsm280000gn/T/TemporaryItems/NSIRD_screencaptureui_TEpnup/Снимок экрана — 2026-08-11 в 10.08.56.png`
- Implementation screenshot: `/private/tmp/agency-os-analytics-final-hydration.png`
- Comparison artifact: `/private/tmp/agency-os-analytics-comparison.png`
- State: production, авторизованный владелец, проект «Озимо», вкладка «Реклама».

## Проверка вида

- Высота графика расхода сокращена примерно в четыре раза; он занимает первую из четырёх
  равных карточек, а не всю ширину страницы.
- Возраст, пол и страны расположены рядом и читаются без вертикальной прокрутки; длина полосы
  кодирует долю, точное значение остаётся справа.
- KPI, блок обновления аудитории, компактные срезы и начало таблицы кампаний помещаются в
  основной рабочей области. Регионы и площадки не конкурируют с главными данными.
- Сохранены существующие типографика, границы, радиусы и спокойные акцентные цвета Agency OS.

## Проверка данных и взаимодействий

- Production sync проекта «Озимо» сохранил 8493 реальных среза за 30 дней.
- Видны ненулевые данные: возраст 25–34 — 5150 показов, женщины — 6427, Италия — 2532.
- Кампания раскрывается до групп объявлений; значения расхода, показов, кликов и CPA остаются
  выровненными и не меняются при раскрытии.
- Прямое открытие рекламной вкладки повторно проверено после исправления детерминированного
  форматирования чисел.
- TypeScript, ESLint, 131 unit-тест и production build: passed.

## Findings

- P0/P1/P2 расхождений не обнаружено.
- P3: подписи оси компактного графика намеренно мельче прежних — точные дневные значения
  доступны через доступные подписи столбцов, а для оперативной оценки важна сама динамика.

final result: passed
---

# Design QA — кликабельные сводные карточки дашборда

- Source screenshot: `/var/folders/q_/sn0glqyj0zb8fnvz7dxlsm280000gn/T/TemporaryItems/NSIRD_screencaptureui_HVRWTK/Снимок экрана — 2026-08-11 в 10.05.37.png`
- Implementation screenshot: `/private/tmp/agency-os-dashboard-clickable.png`
- Comparison artifact: `/private/tmp/agency-os-dashboard-comparison.png`
- Source viewport: 2868 × 538 px (пользовательский снимок верхней части страницы).
- Implementation viewport: 1633 × 829 px; сравнивалась верхняя область 1633 × 320 px.
- State: production, авторизованный владелец, главная страница `/`.

## Проверка вида

- Геометрия, цвета, типографика и порядок четырёх карточек сохранены.
- Интерактивность не добавила лишних видимых элементов в состоянии покоя.
- На hover карточка слегка поднимается и получает тень; для клавиатуры виден focus ring.
- Отличие числа просроченных задач (`1` на исходном снимке и `0` при проверке) вызвано текущими
  production-данными, а не изменением интерфейса.

## Проверка взаимодействий

- «Активные проекты» → `/projects`, заголовок «Проекты» найден.
- «Задачи на сегодня» → `/today`, заголовок «Сегодня» найден.
- «Просрочено» → `/today`, заголовок «Сегодня» найден.
- «Активные клиенты» → `/clients`, заголовок «Клиенты» найден.
- Переход по Enter проверен на карточке «Активные проекты».
- Ошибки и предупреждения в консоли браузера: отсутствуют.

## История сравнения

1. Исходное состояние: карточки информативны, но не являются ссылками.
2. Реализация: карточки обёрнуты в Next.js `Link`, добавлены hover/focus-состояния.
3. Production: визуальное соответствие и все переходы подтверждены.

final result: passed

---

# Analytics report design QA — 2026-10-06

## Reference and scope

Reference: approved production advertising report and the user's screenshot of its
compact Overview / Content / Ads switcher. Extend that existing style, not a new concept.
Reference capture: `/private/tmp/agency-os-analytics-style-reference.jpg`.
Scope: internal project analytics tabs; public report metrics and scoped RPC are retained.

## Verification checkpoints

- Core production release `69e7207`: Team Trip, Talent Press, ALMA checked in logged-in Chrome.
- All three tabs preserve project and dates. Browser Back/Forward updates active tab.
- Period change in Content survives return to Ads. Currency change in Overview retains Overview.
- Talent Press September: results and charts persist between Overview and Ads.
- Team Trip / Talent Press September: organic missing-data state, not false zeroes.
- ALMA historical range: partial coverage, real zeroes, line gaps and seven loaded posts.
- Initial empty-state flows showed no console errors. Populated Content reload later exposed React #418; see resolved finding below.
- Layout release `c9e72c7`: desktop / CSS 390px phone verified; aligned controls and compact KPIs passed.
- Automated gate: 280 tests, ESLint, TypeScript in production build, Webpack build passed.

## Fidelity and intentional differences

- Same project logo/header, neutral compact tabs, filter pills, neutral white surfaces,
  rounded-2xl KPI cards, 32px desktop values, blue chart lines and thin table dividers.
- Content intentionally shows organic reach / interactions / publications rather than
  advertising goals, spending and CPA; no paid audience data is presented as organic.
- Missing historical metrics remain empty instead of plotting false advertising-derived zeroes.
- Daily reach is explicitly a sum, not deduplicated unique people for a whole period.
- Post metrics are captured lifetime snapshots, not falsely attributed to activity inside the window.
- Identified drift: content date control was above adjacent labelled selects.
  Corrected by reusing the advertising report's FilterSelect.
- Mobile density refinement: main content KPI spans the row; two secondary KPIs share the next row.

## Remaining final checks and finding

Tablet calendar was clipped at CSS 800px (left -169px). Fix: viewport-anchored popup below 1200px, preserving the existing owner-mobile treatment. Production `1f480b8`: popup left 16px, right 784px at 800px, all presets and actions visible.

Populated Content initial load exposed React hydration #418. Isolated local development reproduced the exact SVG title mismatch: multiple JSX children are unsupported inside `<title>`. A single interpolated string fixes it. Fresh local browser console is empty; regression SSR test added. Disposable route/config changes reverted and 208MB isolated QA cache removed; existing user dev server preserved.

Production `bd8bbc4` verified in a fresh logged-in Chrome tab: Content loads with populated
graphs, no errors/warnings; Enter activates Overview, Back restores Content, project/dates/
currency remain unchanged. Desktop CSS1837px / tablet800px / phone390px checked; phone
document scroll width equals390px. Temporary viewport reset. No imports or settings writes.
Expired saved Instagram thumbnails identified in production; a neutral icon fallback added,
without refetching or inventing source data. Production `bf13e96`: seven post rows remain,
expired previews resolve to icons, no broken images remain in the table; fresh reload console empty.
Final screenshot: `/private/tmp/agency-os-content-final.png`. Production deployment succeeded,
GitHub branch matches local HEAD. All styling refinements stay inside the existing report design.

final result: passed

## Report currencies — 2026-10-06

- Production `f00cdda` / Vercel agency-os succeeded. Default USD, native/USD/RUB
  compact accessible select stays in the existing Spend card; no extra toolbar.
- GBP account: native and USD spend/goal price checked, result count unchanged.
  A separate click goal remains separate.
- IDR account: native/USD/RUB checked; conversations unchanged.
  Main-goal CPA uses its own campaigns only.
- AED account: native/USD spend and goal price checked, result count unchanged.
  Source table remains AED for reconciliation.
- Switching native → RUB after opening Overview preserves section, dates and project.
- Fresh production tab console: no errors/warnings. Mobile CSS390px: scroll width390,
  currency select within viewport and touch-height44px; temporary viewport reset.
- 295 tests / 47 files, TypeScript, ESLint and Webpack production build pass.
- Native mixed-currency and unknown-rate totals cannot leak as a money total;
  previous-only missing rates do not hide current data. No future rates used.
- Existing owner local dev server has no Supabase URL/key available; browser data QA
  performed on authenticated production instead, without changing its environment.
- Existing node_modules620MB and .next1.0GB reused and retained; no new dependencies,
  clones, downloads or separate build caches. Screenshot lives outside Git:
  `/private/tmp/agency-os-currency-final.png`.

Currency QA result: passed
