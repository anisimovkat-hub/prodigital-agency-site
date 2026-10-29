"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { inspectTelegramBot, repairTelegramBot, type TelegramAdminResult } from "./actions";

export function TelegramBotPanel() {
  const [result, setResult] = useState<TelegramAdminResult>();
  const [confirmed, setConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const health = result?.ok ? result.health : null;
  const yesNo = (value: boolean) => value ? "Включено" : "Выключено";
  return (
    <section className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-sm text-neutral-600">Проверка не создаёт задач и не отправляет сообщений. Результат виден только вам.</p>
      <Button type="button" disabled={pending} onClick={() => startTransition(async () => {
        setConfirmed(false);
        setResult(await inspectTelegramBot());
      })}>{pending ? "Проверяю…" : "Проверить бота"}</Button>
      {result && <p role="status" className={`text-sm ${result.ok ? "text-neutral-700" : "text-red-700"}`}>{result.message}</p>}
      {health && <>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 text-sm">
          <dt>Бот агентства</dt><dd>Подтверждён</dd>
          <dt>Подключение к рабочему сайту</dt><dd>{health.webhook === "expected" ? "Подтверждено" : health.webhook === "missing" ? "Отсутствует" : "Требует проверки"}</dd>
          <dt>Новые сообщения и /start</dt><dd>{yesNo(health.messagesEnabled)}</dd>
          <dt>Нажатия кнопок</dt><dd>{yesNo(health.callbacksEnabled)}</dd>
          <dt>Подключение к рабочим группам</dt><dd>{yesNo(health.membershipEnabled)}</dd>
          <dt>Обновлений в очереди Telegram</dt><dd>{health.pendingUpdates}</dd>
          <dt>В Telegram есть отметка об ошибке доставки</dt><dd>{health.hasDeliveryError ? "Да" : "Нет"}</dd>
          {health.lastDeliveryErrorAt && <><dt>Время последней ошибки</dt><dd>{new Date(health.lastDeliveryErrorAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК</dd></>}
        </dl>
        <p className="text-xs text-neutral-500">Проверено {new Date(health.checkedAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК. Эта проверка подтверждает настройки подключения, а не получение ответа в Telegram.</p>
        {!health.needsRepair && <p className="text-sm text-neutral-600">Приём новых сообщений включён. Если бот молчит, причина пока не установлена — передайте результат в чат настройки.</p>}
        {health.needsRepair && !health.canRepair && <p className="text-sm text-amber-800">Часть сообщений отключена, но для безопасного восстановления нужна дополнительная проверка настройки. Передайте результат в чат настройки.</p>}
        {health.canRepair && <div className="space-y-4 border-t border-neutral-200 pt-4">
          <p className="text-sm">Включим приём сообщений, нажатий кнопок и изменений подключения бота к группам. Адрес подключения и очередь Telegram сохраняются. Само восстановление не отправляет сообщений; накопленные обновления продолжат обрабатываться обычным порядком.</p>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={pending} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />Подтверждаю восстановление приёма сообщений</label>
          <Button type="button" variant="outline" disabled={pending || !confirmed} onClick={() => startTransition(async () => {
            const data = new FormData(); data.set("confirm_restore", "yes");
            setConfirmed(false);
            setResult(await repairTelegramBot(data));
          })}>Восстановить приём сообщений</Button>
        </div>}
      </>}
    </section>
  );
}
