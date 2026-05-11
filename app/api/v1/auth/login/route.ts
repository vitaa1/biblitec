import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { AppError } from "infra/errors";
import { env } from "lib/env";
import { autenticar } from "models/usuarios";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, senha } = body as { email?: string; senha?: string };

    if (!email || !senha) {
      return Response.json(
        { error: "Email e senha são obrigatórios." },
        { status: 400 },
      );
    }

    const usuario = await autenticar(email, senha);

    const token = jwt.sign(
      {
        id: usuario.id,
        papel: usuario.papel,
        girotecaId: usuario.girotecaId,
      },
      env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    const response = NextResponse.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
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
