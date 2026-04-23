import jwt from "jsonwebtoken";
import user from "models/user.js";

export default async function login(request, response) {
  if (request.method !== "POST") {
    return response.status(405).end();
  }

  try {
    const { email, password } = request.body;

    if (!email || !password) {
      return response.status(400).json({
        error: "Email e senha são obrigatórios.",
      });
    }

    const existingUser = await user.findOneByEmail(email);
    if (!existingUser) {
      return response.status(401).json({
        error: "Credenciais inválidas.",
      });
    }

    const passwordMatch = await user.validatePassword(
      password,
      existingUser.password,
    );
    if (!passwordMatch) {
      return response.status(401).json({
        error: "Credenciais inválidas.",
      });
    }

    const token = jwt.sign(
      {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    response.setHeader(
      "Set-Cookie",
      `token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict;${
        process.env.NODE_ENV === "production" ? " Secure;" : ""
      }`,
    );

    return response.status(200).json({
      id: existingUser.id,
      name: existingUser.name,
      email: existingUser.email,
      role: existingUser.role,
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Erro interno do servidor." });
  }
}
