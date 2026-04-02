import { StudentsRepository } from "infra/repositories/StudentsRepository.js";

const repository = new StudentsRepository();

async function findAll() {
  return repository.findAll();
}

async function create({ name, registration }) {
  if (!name || !registration) {
    const error = new Error("name e registration são obrigatórios.");
    error.status_code = 400;
    throw error;
  }

  const existingStudent = await repository.findByRegistration(registration);
  if (existingStudent) {
    const error = new Error("Matrícula já cadastrada.");
    error.status_code = 409;
    throw error;
  }

  return repository.create({ name, registration });
}

async function findOneById(id) {
  return repository.findById(id);
}

export default { findAll, create, findOneById };
