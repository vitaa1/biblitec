import { LoansRepository } from "infra/repositories/LoansRepository.js";

const repository = new LoansRepository();

async function borrow(createdByUserId, studentId, bookId, dueDays) {
  if (!createdByUserId || !studentId || !bookId) {
    const error = new Error(
      "created_by_user_id, student_id e book_id são obrigatórios.",
    );
    error.status_code = 400;
    throw error;
  }

  const days = parseInt(dueDays);
  if (!days || days <= 0) {
    const error = new Error(
      "due_days é obrigatorio e deve ser um numero maior que zero.",
    );
    error.status_code = 400;
    throw error;
  }
  return repository.createLoan(createdByUserId, studentId, bookId, days);
}

async function returnBook(loanId) {
  return repository.returnLoan(loanId);
}

async function findAll({ page = 1, limit = 20 } = {}) {
  const offset = (parseInt(page) - 1) * parseInt(limit);
  return repository.findAll({ limit: parseInt(limit), offset });
}

export default { borrow, returnBook, findAll };
