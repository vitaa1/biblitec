import bcrypt from "bcryptjs";
import database from "infra/database";
import { AppError } from "infra/errors";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "USER";
  created_at: string;
}

export type PublicUser = Omit<User, "password">;

function validateName(name: unknown): string {
  if (typeof name !== "string" || name.trim().length < 3) {
    throw new AppError("Nome deve ter pelo menos 3 caracteres.", 400);
  }
  return name.trim();
}

function validateEmail(email: unknown): string {
  const normalized = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AppError("Email inválido.", 400);
  }
  return normalized;
}

function validateNewPassword(password: unknown): string {
  if (typeof password !== "string" || password.length < 8) {
    throw new AppError("Senha deve ter pelo menos 8 caracteres.", 400);
  }
  return password;
}

async function findOneByEmail(email: string): Promise<User | null> {
  const result = await database.query({
    text: "SELECT * FROM users WHERE email = $1 LIMIT 1",
    values: [email],
  });
  return result.rows[0] ?? null;
}

async function create(data: {
  name: unknown;
  email: unknown;
  password: unknown;
  role?: "ADMIN" | "USER";
}): Promise<PublicUser> {
  const name = validateName(data.name);
  const email = validateEmail(data.email);
  const password = validateNewPassword(data.password);
  const hashedPassword = await bcrypt.hash(password, 10);
  const VALID_ROLES = ["ADMIN", "USER"] as const;
  const role: "ADMIN" | "USER" = VALID_ROLES.includes(
    data.role as "ADMIN" | "USER",
  )
    ? (data.role as "ADMIN" | "USER")
    : "USER";

  const result = await database.query({
    text: `
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at
    `,
    values: [name, email, hashedPassword, role],
  });
  return result.rows[0];
}

async function countUsers(): Promise<number> {
  const result = await database.query({
    text: "SELECT COUNT(*)::int AS total FROM users",
  });
  return result.rows[0].total;
}

async function validatePassword(
  providedPassword: string,
  storedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(providedPassword, storedPassword);
}

const user = { findOneByEmail, create, countUsers, validatePassword };
export default user;
