"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RecoveryState = "loading" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setRecoveryState("ready");
      }
    });

    void supabase.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError || !sessionData.session) {
        setRecoveryState("invalid");
        return;
      }
      setRecoveryState("ready");
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password.length < 8) {
      setError("Пароль должен быть не короче 8 символов.");
      return;
    }
    if (password !== confirmation) {
      setError("Пароли не совпадают.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setPending(false);
      setError("Ссылка устарела или недействительна. Запросите новую.");
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?password=updated");
    router.refresh();
  }

  const isLoading = recoveryState === "loading";
  const isInvalid = recoveryState === "invalid";

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Новый пароль</CardTitle>
          <p className="text-sm text-neutral-500">
            Создайте новый пароль для входа в Agency OS.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-neutral-500">Проверяем ссылку…</p>
          ) : isInvalid ? (
            <div className="flex flex-col gap-4 text-sm text-neutral-700">
              <p>Ссылка уже использована или устарела. Запросите новую.</p>
              <a href="/forgot-password" className="text-neutral-500 hover:underline">
                Получить новую ссылку
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Новый пароль</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmation">Повторите пароль</Label>
                <Input
                  id="confirmation"
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={pending}>
                {pending ? "Сохраняем..." : "Сохранить новый пароль"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
