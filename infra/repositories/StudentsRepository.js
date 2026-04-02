import database from "infra/database.js";

export class StudentsRepository {
  async findAll() {
    const { rows } = await database.query({
      text: "SELECT * FROM students ORDER BY name ASC",
    });
    return rows;
  }

  async findByRegistration(registration) {
    const { rows } = await database.query({
      text: "SELECT * FROM students WHERE registration = $1 LIMIT 1",
      values: [registration],
    });
    return rows[0] ?? null;
  }

  async findById(id) {
    const { rows } = await database.query({
      text: "SELECT * FROM students WHERE id = $1 LIMIT 1",
      values: [id],
    });
    return rows[0] ?? null;
  }

  async create(data) {
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
