"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppError } from "infra/errors";
import { loginSchema, parseBody } from "infra/schemas";
import { assinarToken } from "lib/auth";
import { env } from "lib/env";
import { autenticar } from "models/usuarios";

export type LoginState = { ok: false; error: string } | null;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = parseBody(loginSchema, {
    email: formData.get("email"),
    senha: formData.get("senha"),
  });

  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  try {
    const usuario = await autenticar(parsed.data.email, parsed.data.senha);

    const token = assinarToken({
      id: usuario.id,
      papel: usuario.papel,
      girotecaId: usuario.girotecaId,
    });

    const cookieStore = await cookies();
    cookieStore.set("token", token, {
      httpOnly: true,
      path: "/",
      maxAge: 86400,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
    });
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Erro interno. Tente novamente." };
  }

  redirect("/dashboard");
}
