/** What each ad platform needs from the person who connects an account. Add new platforms here. */
export type AdPlatformField = { name: string; label: string; secret?: boolean; placeholder?: string; optional?: boolean };
export type AdPlatformConfig = { value: string; label: string; fields: AdPlatformField[]; help: string[]; link?: { label: string; href: string } };

export const AD_PLATFORMS: AdPlatformConfig[] = [
  {
    value: "meta",
    label: "Meta (Facebook / Instagram)",
    fields: [],
    help: [
      "Ключ не нужен: Meta подключена общим доступом агентства.",
      "Если нужного кабинета нет в списке, в Business Manager выдайте к нему доступ системному пользователю Agency OS, затем нажмите «Найти новые кабинеты Meta».",
    ],
  },
  {
    value: "yandex_direct",
    label: "Яндекс.Директ",
    fields: [
      { name: "client_login", label: "Логин кабинета клиента", placeholder: "client-login", optional: true },
      { name: "token", label: "OAuth-токен", secret: true },
    ],
    help: [
      "Токен: войдите в Яндекс под своим логином, откройте ссылку ниже, нажмите «Разрешить» и скопируйте токен.",
      "Кабинет клиента: клиент добавляет ваш логин в «Представители» своего Директа, а здесь указывается его логин. Для вашего собственного кабинета логин можно не заполнять.",
    ],
    link: { label: "Получить токен Яндекса", href: "https://oauth.yandex.ru/authorize?response_type=token&client_id=73f91f61d89240019c8bc2687ca48d73" },
  },
  {
    value: "telegram_ads",
    label: "Telegram Ads",
    fields: [
      { name: "name", label: "Название кабинета", placeholder: "например, Сода — Telegram" },
      { name: "token", label: "API-токен кабинета", secret: true },
    ],
    help: ["Токен берётся в кабинете ads.telegram.org в настройках API. У каждого кабинета свой токен. Расход в TON переводится в рубли по текущему курсу."],
  },
  {
    value: "vk",
    label: "VK Реклама",
    fields: [
      { name: "client_id", label: "Client ID" },
      { name: "client_secret", label: "Client secret", secret: true },
    ],
    help: ["В ads.vk.com: Настройки → Доступ к API → создать ключ. Скопируйте Client ID и Client secret этого кабинета."],
  },
];
