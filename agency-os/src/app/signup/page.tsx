"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: {
        data: {
          full_name: String(form.get("full_name")),
          invite_code: String(form.get("invite_code")).trim(),
        },
      },
    });

    setPending(false);
    if (signUpError) {
      setError(
        signUpError.message.includes("код приглашения") ||
          signUpError.message.includes("Database error")
          ? "Недействительный или уже использованный код приглашения"
          : signUpError.message.includes("already registered")
            ? "Пользователь с таким email уже существует"
            : signUpError.message,
      );
      return;
    }
    if (data.session) {
      router.push("/");
      router.refresh();
    } else {
      setNeedsConfirm(true);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Регистрация в Agency OS</CardTitle>
          <p className="text-sm text-neutral-500">
            Нужен код приглашения от администратора
          </p>
        </CardHeader>
        <CardContent>
          {needsConfirm ? (
            <p className="text-sm text-neutral-700">
              Почти готово! Мы отправили письмо на вашу почту — перейдите по
              ссылке в нём, чтобы подтвердить аккаунт, затем войдите.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="full_name">Имя</Label>
                <Input id="full_name" name="full_name" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite_code">Код приглашения</Label>
                <Input id="invite_code" name="invite_code" required />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={pending} className="mt-2">
                {pending ? "Создаём..." : "Зарегистрироваться"}
              </Button>
              <a
                href="/login"
                className="text-center text-sm text-neutral-500 hover:underline"
              >
                Уже есть аккаунт? Войти
              </a>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
