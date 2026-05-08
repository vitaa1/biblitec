import database from "infra/database";

export interface Student {
  id: string;
  nome: string;
  matricula: string;
  criado_em: string;
}

export class StudentsRepository {
  async findAll(): Promise<Student[]> {
    const { rows } = await database.query({
      text: "SELECT * FROM leitores ORDER BY nome ASC",
    });
    return rows;
  }

  async findByRegistration(matricula: string): Promise<Student | null> {
    const { rows } = await database.query({
      text: "SELECT * FROM leitores WHERE matricula = $1 LIMIT 1",
      values: [matricula],
    });
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<Student | null> {
    const { rows } = await database.query({
      text: "SELECT * FROM leitores WHERE id = $1 LIMIT 1",
      values: [id],
    });
    return rows[0] ?? null;
  }

  async create(data: { nome: string; matricula: string }): Promise<Student> {
    const { rows } = await database.query({
      text: `
        INSERT INTO leitores (nome, matricula)
        VALUES ($1, $2)
        RETURNING *
      `,
      values: [data.nome, data.matricula],
    });
    return rows[0];
  }
}
