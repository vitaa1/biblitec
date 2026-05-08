import database from "infra/database";

export interface User {
  id: string;
  nome: string;
  email: string;
  senha: string;
  papel: "ADMIN" | "USER";
  criado_em: string;
}

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await database.query({
      text: "SELECT * FROM usuarios WHERE email = $1 LIMIT 1",
      values: [email],
    });
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await database.query({
      text: "SELECT * FROM usuarios WHERE id = $1 LIMIT 1",
      values: [id],
    });
    return rows[0] ?? null;
  }

  async create(data: {
    nome: string;
    email: string;
    senha: string;
    papel: "ADMIN" | "USER";
  }): Promise<User> {
    const { rows } = await database.query({
      text: `INSERT INTO usuarios (email, senha, nome, papel)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
      values: [data.email, data.senha, data.nome, data.papel],
    });
    return rows[0];
  }

  async countUsers(): Promise<number> {
    const { rows } = await database.query({
      text: "SELECT COUNT(*)::int AS total FROM usuarios",
    });
    return rows[0].total;
  }
}
