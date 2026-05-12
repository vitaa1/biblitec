import { NextResponse } from "next/server";
import { AppError } from "infra/errors";
import { loginSchema, parseBody } from "infra/schemas";
import { assinarToken } from "lib/auth";
import { contextoFromRequest } from "lib/contexto";
import { env } from "lib/env";
import { criarRateLimiter } from "lib/rate-limit";
import { autenticar, buscarProprioPerfil } from "models/usuarios";

const limiter = criarRateLimiter({ maxTentativas: 5, janelaSeg: 60 });

export async function POST(request: Request) {
  const parsed = parseBody(loginSchema, await request.json().catch(() => null));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const { email, senha } = parsed.data;
  const chave = email.toLowerCase().trim();

  if (limiter.bloqueado(chave)) {
    return Response.json(
      { error: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  try {
    const usuario = await autenticar(email, senha);

    const token = assinarToken({
      id: usuario.id,
      papel: usuario.papel,
      girotecaId: usuario.girotecaId,
    });

    const response = NextResponse.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      girotecaId: usuario.girotecaId,
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      path: "/",
      maxAge: 86400,
      sameSite: "strict",
      secure: env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    if (error instanceof AppError) {
      if (error.status_code === 401) limiter.registrarFalha(chave);
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    console.error(error);
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    message: "Logout realizado com sucesso.",
  });

  response.cookies.set("token", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
    sameSite: "strict",
  });

  return response;
}

export async function GET(request: Request) {
  try {
    const contexto = contextoFromRequest(request);
    const usuario = await buscarProprioPerfil(contexto);
    return Response.json(usuario);
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json(
        { error: error.message },
        { status: error.status_code },
      );
    }
    return Response.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
