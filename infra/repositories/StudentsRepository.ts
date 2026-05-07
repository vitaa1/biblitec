import database from "infra/database";

export interface Student {
  id: string;
  name: string;
  registration: string;
  created_at: string;
}

export class StudentsRepository {
  async findAll(): Promise<Student[]> {
    const { rows } = await database.query({
      text: "SELECT * FROM students ORDER BY name ASC",
    });
    return rows;
  }

  async findByRegistration(registration: string): Promise<Student | null> {
    const { rows } = await database.query({
      text: "SELECT * FROM students WHERE registration = $1 LIMIT 1",
      values: [registration],
    });
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<Student | null> {
    const { rows } = await database.query({
      text: "SELECT * FROM students WHERE id = $1 LIMIT 1",
      values: [id],
    });
    return rows[0] ?? null;
  }

  async create(data: { name: string; registration: string }): Promise<Student> {
    const { rows } = await database.query({
      text: `
        INSERT INTO students (name, registration)
        VALUES ($1, $2)
        RETURNING *
      `,
      values: [data.name, data.registration],
    });
    return rows[0];
  }
}
