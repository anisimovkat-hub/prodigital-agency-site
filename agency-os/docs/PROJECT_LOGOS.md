# Логотипы проектов

Логотипы хранятся локально в `public/project-logos/`, чтобы интерфейс не зависел от скорости,
доступности и политики hotlinking внешних сайтов. Связь с проектом задаётся по стабильному UUID
в `src/lib/project-logos.ts`; заполненное вручную поле `projects.logo_url` имеет приоритет.

## Подключённые бренды

| Проект | Источник | Файл |
|---|---|---|
| ВФЛА | https://rusathletics.info/ | `vfla.svg` |
| Leaders First | https://career.leadersfirst.org/ | `leaders-first.png` |
| Bakers | https://drbakers.ru/ | `dr-bakers.svg` |
| Ansaligy | https://ansaligy.com/ | `ansaligy.svg` |
| ESTT | https://estt.ru/ | `estt.svg` |
| Колвика | https://kolvika.group/ | `kolvika.svg` |
| Пакс (пакетные туры) | https://paks.ru/ | `paks.svg` |
| Team Trip | https://team-trip.ru/ | `team-trip.png` |
| Vard | https://vard.ru/ | `vard.svg` |
| Электроника | https://system-r.ru/ | `system-r.svg` |
| Coral Travel | https://crl.travel/ | `coral-travel.svg` |
| Поларис | https://polaris.ru/ | `polaris.svg` |

## Проекты без автоматической привязки

Для остальных названий, включая «Сад на Бали // Единорожки», поиск не дал однозначного
официального бренда либо проект является
внутренним/личным. Им показывается стабильная цветная заглушка с инициалами. Это осознанно:
неверный логотип одноимённой компании хуже нейтральной заглушки. В редакторе проекта можно
указать точную ссылку в поле «Логотип», и она автоматически заменит локальную заглушку.
