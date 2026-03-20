import { database } from './database.js'

export class UserRepository {
  async findByEmail(email) {
    const { rows } = await database.query({
      text: 'SELECT * FROM users WHERE email = $1 LIMIT 1',
      values: [email],
    })
    return rows[0] ?? null
  }

  async create(data) {
    const { rows } = await database.query({
      text: `INSERT INTO users (email, password, name, role)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
      values: [data.email, data.password, data.name, data.role],
    })
    return rows[0]
  }

  async findById(id) {
    const { rows } = await database.query({
      text: 'SELECT * FROM users WHERE id = $1 LIMIT 1',
      values: [id],
    })
    return rows[0] ?? null
  }
}