import database from "infra/database";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "USER";
  created_at: string;
}

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await database.query({
      text: "SELECT * FROM users WHERE email = $1 LIMIT 1",
      values: [email],
    });
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await database.query({
      text: "SELECT * FROM users WHERE id = $1 LIMIT 1",
      values: [id],
    });
    return rows[0] ?? null;
  }

  async create(data: {
    name: string;
    email: string;
    password: string;
    role: "ADMIN" | "USER";
  }): Promise<User> {
    const { rows } = await database.query({
      text: `INSERT INTO users (email, password, name, role)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
      values: [data.email, data.password, data.name, data.role],
    });
    return rows[0];
  }
}
