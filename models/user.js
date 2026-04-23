import bcrypt from "bcryptjs";
import database from "infra/database.js";

function validateName(name) {
  if (typeof name !== "string" || name.trim().length < 3) {
    const error = new Error("Nome deve ter pelo menos 3 caracteres.");
    error.status_code = 400;
    throw error;
  }

  return name.trim();
}

function validateEmail(email) {
  const normalizedEmail = email?.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail)) {
    const error = new Error("Email inválido.");
    error.status_code = 400;
    throw error;
  }

  return normalizedEmail;
}

function validateNewPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    const error = new Error("Senha deve ter pelo menos 8 caracteres.");
    error.status_code = 400;
    throw error;
  }

  return password;
}

async function findOneByEmail(email) {
  const result = await database.query({
    text: `SELECT * FROM users WHERE email = $1 LIMIT 1`,
    values: [email],
  });
  return result.rows[0] ?? null;
}

async function create({ name, email, password }) {
  const validatedName = validateName(name);
  const validatedEmail = validateEmail(email);
  const validatedPassword = validateNewPassword(password);
  const hashedPassword = await bcrypt.hash(validatedPassword, 10);

  const result = await database.query({
    text: `
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, role, created_at
    `,
    values: [validatedName, validatedEmail, hashedPassword, "ADMIN"],
  });

  return result.rows[0];
}

async function countUsers() {
  const result = await database.query({
    text: "SELECT COUNT(*)::int AS total FROM users",
  });

  return result.rows[0].total;
}

async function validatePassword(providedPassword, storedPassword) {
  return bcrypt.compare(providedPassword, storedPassword);
}

export default { findOneByEmail, create, countUsers, validatePassword };
