import { AppError } from "infra/errors";
import {
  StudentsRepository,
  type Student,
} from "infra/repositories/StudentsRepository";

export type { Student };

const repository = new StudentsRepository();

function validateName(name: unknown): string {
  if (typeof name !== "string" || name.trim().length < 3) {
    throw new AppError("Nome deve ter pelo menos 3 caracteres.", 400);
  }
  return name.trim();
}

function validateRegistration(registration: unknown): string {
  const normalized = String(registration ?? "")
    .trim()
    .toUpperCase();
  if (normalized.length < 3) {
    throw new AppError(
      "Matrícula deve ter pelo menos 3 caracteres válidos.",
      400,
    );
  }
  return normalized;
}

async function findAll(): Promise<Student[]> {
  return repository.findAll();
}

async function create(data: {
  name: unknown;
  registration: unknown;
}): Promise<Student> {
  const name = validateName(data.name);
  const registration = validateRegistration(data.registration);

  const existing = await repository.findByRegistration(registration);
  if (existing) throw new AppError("Matrícula já cadastrada.", 409);

  return repository.create({ name, registration });
}

async function findOneById(id: string): Promise<Student | null> {
  return repository.findById(id);
}

export default { findAll, create, findOneById };
