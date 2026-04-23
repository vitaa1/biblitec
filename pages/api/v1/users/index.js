import jwt from "jsonwebtoken";
import user from "models/user.js";

export default async function users(request, response) {
  if (request.method !== "POST") {
    return response.status(405).end();
  }

  try {
    const { name, email, password } = request.body;
    const totalUsers = await user.countUsers();

    if (totalUsers > 0) {
      const token = request.cookies.token;

      if (!token) {
        return response.status(401).json({
          error: "Autenticação obrigatória para criar novos usuários.",
        });
      }

      let decodedToken;

      try {
        decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return response.status(401).json({
          error: "Token inválido ou expirado.",
        });
      }

      if (decodedToken.role !== "ADMIN") {
        return response.status(403).json({
          error: "Apenas administradores podem criar novos usuários.",
        });
      }
    }

    const existingUser = await user.findOneByEmail(email?.trim().toLowerCase());
    if (existingUser) {
      return response.status(409).json({
        error: "Email já cadastrado.",
      });
    }

    const newUser = await user.create({
      name,
      email,
      password,
    });

    return response.status(201).json(newUser);
  } catch (error) {
    const status = error.status_code ?? 500;
    const message =
      status === 500 ? "Erro interno do servidor." : error.message;

    if (status === 500) {
      console.error(error);
    }

    return response.status(status).json({ error: message });
  }
}
