import { AppError } from "infra/errors";
import {
  StudentsRepository,
  type Student,
} from "infra/repositories/StudentsRepository";

export type { Student };

const repository = new StudentsRepository();

function validateNome(nome: unknown): string {
  if (typeof nome !== "string" || nome.trim().length < 3) {
    throw new AppError("Nome deve ter pelo menos 3 caracteres.", 400);
  }
  return nome.trim();
}

function validateMatricula(matricula: unknown): string {
  const normalized = String(matricula ?? "")
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
  nome: unknown;
  matricula: unknown;
}): Promise<Student> {
  const nome = validateNome(data.nome);
  const matricula = validateMatricula(data.matricula);

  const existing = await repository.findByRegistration(matricula);
  if (existing) throw new AppError("Matrícula já cadastrada.", 409);

  return repository.create({ nome, matricula });
}

async function findOneById(id: string): Promise<Student | null> {
  return repository.findById(id);
}

const student = { findAll, create, findOneById };
export default student;
