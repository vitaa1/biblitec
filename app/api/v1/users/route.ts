import jwt from "jsonwebtoken";
import { env } from "lib/env";
import { AppError } from "infra/errors";
import { createUserSchema, parseBody } from "infra/schemas";
import user from "models/user";
import { type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseBody(createUserSchema, body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const { nome, email, senha, papel } = parsed.data;
    const totalUsers = await user.countUsers();

    if (totalUsers > 0) {
      const token = request.cookies.get("token")?.value;

      if (!token) {
        return Response.json(
          { error: "Autenticação obrigatória para criar novos usuários." },
          { status: 401 },
        );
      }

      let decodedToken: { papel: string };
      try {
        decodedToken = jwt.verify(token, env.JWT_SECRET) as {
          papel: string;
        };
      } catch {
        return Response.json(
          { error: "Token inválido ou expirado." },
          { status: 401 },
        );
      }

      if (decodedToken.papel !== "ADMIN") {
        return Response.json(
          { error: "Apenas administradores podem criar novos usuários." },
          { status: 403 },
        );
      }
    }

    const existingUser = await user.findOneByEmail(email?.trim().toLowerCase());
    if (existingUser) {
      return Response.json({ error: "Email já cadastrado." }, { status: 409 });
    }

    // primeiro usuário (bootstrap) sempre é ADMIN
    const effectivePapel = totalUsers === 0 ? "ADMIN" : papel;
    const newUser = await user.create({
      nome,
      email,
      senha,
      papel: effectivePapel,
    });
    return Response.json(newUser, { status: 201 });
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
