# Design QA — маркетинговая аналитика

- source visual truth: `/var/folders/q_/sn0glqyj0zb8fnvz7dxlsm280000gn/T/TemporaryItems/NSIRD_screencaptureui_wWAuYR/Снимок экрана — 2026-08-10 в 14.23.42.png`
- source pixels: 2940 × 1912 (macOS Retina screenshot)
- target viewport: desktop, приблизительно 1470 × 956 CSS px при device scale factor 2
- state: авторизованный владелец, `/analytics`, проект CSS // Лондон, канал Meta Ads, вкладка «Реклама»
- implementation screenshot: отсутствует — новый commit ещё не опубликован в production
- density normalization: не выполнялась, так как нет implementation capture

## Full-view comparison evidence

Исходный экран открыт и проверен: основной график занимает слишком много вертикального места,
а таблица каналов уходит ниже первого экрана. В реализации уменьшены высота SVG-графика,
внутренние отступы KPI/insights и общий вертикальный gap; детальные таблицы расположены после
основного обзора. Сравнить результат визуально пока нельзя без production deploy.

## Focused region comparison evidence

Проверены по исходному скриншоту верхняя панель фильтров, ряд KPI и область графика. Новый
рендер этих областей не захвачен, поэтому точное сравнение выравнивания, типографики и
высоты первого экрана заблокировано.

## Findings

- [P1] Нет browser-rendered evidence новой версии.
  - Блокер: публикация commit ожидает явного разрешения на включение обновлённых проектных
    MD-файлов с внутренними идентификаторами и рабочим email.
  - Fix: после push дождаться Vercel Ready, открыть авторизованный `/analytics` при том же
    проекте/периоде, сделать screenshot и повторить сравнение.

## Required fidelity surfaces

- Typography: код использует существующий Geist и прежнюю иерархию; визуально не подтверждено.
- Spacing/layout: целевые значения уменьшены; визуально не подтверждено.
- Colors/tokens: сохранена действующая палитра и semantic colors; визуально не подтверждено.
- Image quality: новых растровых ассетов нет; Instagram thumbnails остаются исходными Meta CDN.
- Copy/content: «Вся статистика», компактный обзор и отдельные цели кампаний реализованы в коде.

## Comparison history

1. Исходный скриншот: P1 — основной график чрезмерно высокий; P2 — подробности конкурируют
   с главной информацией. Исправления внесены, post-fix screenshot отсутствует.

## Primary interactions to test after deploy

- мгновенное переключение «Вся статистика / Органика / Реклама»;
- применение периода/проекта/канала;
- скролл к целям кампаний, публикациям, аудитории, группам и объявлениям;
- запуск Instagram sync и Meta audience sync;
- ошибки console/network при авторизованном просмотре.

final result: blocked
