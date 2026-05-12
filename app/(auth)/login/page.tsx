"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";
import type { LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar no sistema"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, action] = useActionState<LoginState, FormData>(
    loginAction,
    null,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Biblitec</h1>
          <p className="text-sm text-muted-foreground">
            Sistema de gestão das girotecas
          </p>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Entrar na conta</CardTitle>
          </CardHeader>
          <CardContent>
            {state?.ok === false && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
              >
                <span aria-hidden="true">⚠️</span>
                <span>{state.error}</span>
              </div>
            )}

            <form action={action} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  name="senha"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>

              <SubmitButton />
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
