import user from "models/user.js";

export default async function users(request, response) {
  if (request.method !== "POST") {
    return response.status(405).end();
  }

  try {
    const { name, email, password } = request.body;

    if (!name || !email || !password) {
      return response.status(400).json({
        error: "Nome, email e senha são obrigatórios.",
      });
    }

    const existingUser = await user.findOneByEmail(email);
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
    console.error(error);
    return response.status(500).json({ error: "Erro interno do servidor." });
  }
}
