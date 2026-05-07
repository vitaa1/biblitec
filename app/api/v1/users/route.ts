import jwt from "jsonwebtoken";
import { AppError } from "infra/errors";
import user from "models/user";
import { type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, role } = await request.json();
    const totalUsers = await user.countUsers();

    if (totalUsers > 0) {
      const token = request.cookies.get("token")?.value;

      if (!token) {
        return Response.json(
          { error: "Autenticação obrigatória para criar novos usuários." },
          { status: 401 },
        );
      }

      let decodedToken: { role: string };
      try {
        decodedToken = jwt.verify(token, process.env.JWT_SECRET as string) as {
          role: string;
        };
      } catch {
        return Response.json(
          { error: "Token inválido ou expirado." },
          { status: 401 },
        );
      }

      if (decodedToken.role !== "ADMIN") {
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
    const effectiveRole = totalUsers === 0 ? "ADMIN" : role;
    const newUser = await user.create({
      name,
      email,
      password,
      role: effectiveRole,
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
