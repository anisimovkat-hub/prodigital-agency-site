"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const redirectTo = new URL("/reset-password", window.location.origin).toString();
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(
      email,
      { redirectTo },
    );

    setPending(false);
    if (resetError) {
      setError("Не удалось отправить письмо. Попробуйте ещё раз через несколько минут.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Восстановление пароля</CardTitle>
          <p className="text-sm text-neutral-500">
            Отправим ссылку для создания нового пароля.
          </p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-4 text-sm text-neutral-700">
              <p>
                Если этот email зарегистрирован, письмо уже отправлено. Проверьте
                «Входящие» и папку «Спам».
              </p>
              <a href="/login" className="text-neutral-500 hover:underline">
                Вернуться ко входу
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@agency.com"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={pending}>
                {pending ? "Отправляем..." : "Получить ссылку"}
              </Button>
              <a href="/login" className="text-center text-sm text-neutral-500 hover:underline">
                Вернуться ко входу
              </a>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
