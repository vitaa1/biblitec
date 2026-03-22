import bcrypt from "bcryptjs";
import database from "infra/database.js";

async function findOneByEmail(email) {
  const result = await database.query({
    text: `SELECT * FROM users WHERE email = $1 LIMIT 1`,
    values: [email],
  });
  return result.rows[0] ?? null;
}

async function create({ name, email, password }) {
  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await database.query({
    text: `
      INSERT INTO users (name, email, password)
      VALUES ($1, $2, $3)
      RETURNING id, name, role, created_at
    `,
    values: [name, email, hashedPassword],
  });

  return result.rows[0];
}

async function validatePassword(providedPassword, storedPassword) {
  return bcrypt.compare(providedPassword, storedPassword);
}

export default { findOneByEmail, create, validatePassword };
