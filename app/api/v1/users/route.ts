import jwt from "jsonwebtoken";
import user from "models/user";
import { type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();
    const totalUsers = await user.countUsers();

    if (totalUsers > 0) {
      const token = request.cookies.get("token")?.value;

      if (!token) {
        return Response.json(
          { error: "Autenticação obrigatória para criar novos usuários." },
          { status: 401 },
        );
      }

      let decodedToken: any;
      try {
        decodedToken = jwt.verify(token, process.env.JWT_SECRET as string);
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

    const newUser = await user.create({ name, email, password });
    return Response.json(newUser, { status: 201 });
  } catch (error: any) {
    const status = error.status_code ?? 500;
    const message =
      status === 500 ? "Erro interno do servidor." : error.message;

    if (status === 500) {
      console.error(error);
    }

    return Response.json({ error: message }, { status });
  }
}
