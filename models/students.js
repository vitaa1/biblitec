import { StudentsRepository } from "infra/repositories/StudentsRepository.js";

const repository = new StudentsRepository();

function validateName(name) {
  if (typeof name !== "string" || name.trim().length < 3) {
    const error = new Error("Nome deve ter pelo menos 3 caracteres.");
    error.status_code = 400;
    throw error;
  }

  return name.trim();
}

function validateRegistration(registration) {
  const normalizedRegistration = registration?.trim().toUpperCase();

  if (!normalizedRegistration || normalizedRegistration.length < 3) {
    const error = new Error(
      "Matrícula deve ter pelo menos 3 caracteres válidos.",
    );
    error.status_code = 400;
    throw error;
  }

  return normalizedRegistration;
}

async function findAll() {
  return repository.findAll();
}

async function create({ name, registration }) {
  const validatedName = validateName(name);
  const validatedRegistration = validateRegistration(registration);

  const existingStudent = await repository.findByRegistration(
    validatedRegistration,
  );
  if (existingStudent) {
    const error = new Error("Matrícula já cadastrada.");
    error.status_code = 409;
    throw error;
  }

  return repository.create({
    name: validatedName,
    registration: validatedRegistration,
  });
}

async function findOneById(id) {
  return repository.findById(id);
}

export default { findAll, create, findOneById };
