import { LoansRepository } from "infra/repositories/LoansRepository.js";
import { StudentsRepository } from "infra/repositories/StudentsRepository.js";
import { BookRepository } from "infra/repositories/BookRepository";

const repository = new LoansRepository();
const studentsRepository = new StudentsRepository();
const booksRepository = new BookRepository();

function validatePaginationNumber(value, fieldName, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    const error = new Error(
      `${fieldName} deve ser um número inteiro positivo.`,
    );
    error.status_code = 400;
    throw error;
  }

  return parsedValue;
}

async function borrow(createdByUserId, studentId, bookId, dueDays) {
  if (!createdByUserId || !studentId || !bookId) {
    const error = new Error(
      "created_by_user_id, student_id e book_id são obrigatórios.",
    );
    error.status_code = 400;
    throw error;
  }

  const days = Number.parseInt(dueDays, 10);
  if (!Number.isInteger(days) || days <= 0 || days > 60) {
    const error = new Error(
      "due_days é obrigatório e deve ser um número entre 1 e 60.",
    );
    error.status_code = 400;
    throw error;
  }

  const student = await studentsRepository.findById(studentId);
  if (!student) {
    const error = new Error("Aluno não encontrado.");
    error.status_code = 404;
    throw error;
  }

  const book = await booksRepository.findById(bookId);
  if (!book) {
    const error = new Error("Livro não encontrado.");
    error.status_code = 404;
    throw error;
  }

  return repository.createLoan(createdByUserId, studentId, bookId, days);
}

async function returnBook(loanId) {
  return repository.returnLoan(loanId);
}

async function findAll({ page = 1, limit = 20 } = {}) {
  const safePage = validatePaginationNumber(page, "page", 1);
  const safeLimit = validatePaginationNumber(limit, "limit", 20);
  const offset = (safePage - 1) * safeLimit;

  return repository.findAll({ limit: safeLimit, offset });
}

export default { borrow, returnBook, findAll };
