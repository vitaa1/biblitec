import bcrypt from "bcryptjs";
import { AppError } from "infra/errors";
import { UserRepository, type User } from "infra/repositories/UserRepository";

export type { User };

export type PublicUser = Omit<User, "senha">;

const repository = new UserRepository();

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
  return repository.findByEmail(email);
}

async function create(data: {
  nome: unknown;
  email: unknown;
  senha: unknown;
  papel?: "ADMIN" | "USER";
}): Promise<PublicUser> {
  const nome = validateName(data.nome);
  const email = validateEmail(data.email);
  const password = validateNewPassword(data.senha);
  const hashedPassword = await bcrypt.hash(password, 10);
  const papel: "ADMIN" | "USER" =
    data.papel === "ADMIN" || data.papel === "USER" ? data.papel : "USER";

  const created = await repository.create({
    nome,
    email,
    senha: hashedPassword,
    papel,
  });
  return {
    id: created.id,
    nome: created.nome,
    email: created.email,
    papel: created.papel,
    criado_em: created.criado_em,
  };
}

async function countUsers(): Promise<number> {
  return repository.countUsers();
}

async function validatePassword(
  providedPassword: string,
  storedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(providedPassword, storedPassword);
}

const user = { findOneByEmail, create, countUsers, validatePassword };
export default user;
