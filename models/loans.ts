import { AppError } from "infra/errors";
import { BookRepository } from "infra/repositories/BookRepository";
import {
  LoansRepository,
  type Loan,
  type LoanWithDetails,
} from "infra/repositories/LoansRepository";
import { StudentsRepository } from "infra/repositories/StudentsRepository";
import { validatePaginationNumber } from "infra/shared";

export type { Loan, LoanWithDetails };

const repository = new LoansRepository();
const studentsRepository = new StudentsRepository();
const booksRepository = new BookRepository();

async function borrow(
  createdByUserId: string,
  studentId: string,
  bookId: string,
  dueDays: unknown,
): Promise<Loan> {
  if (!createdByUserId || !studentId || !bookId) {
    throw new AppError(
      "criado_por_usuario_id, leitor_id e livro_id são obrigatórios.",
      400,
    );
  }

  const days = Number.parseInt(String(dueDays ?? ""), 10);
  if (!Number.isInteger(days) || days <= 0 || days > 60) {
    throw new AppError(
      "dias_prazo é obrigatório e deve ser um número entre 1 e 60.",
      400,
    );
  }

  const student = await studentsRepository.findById(studentId);
  if (!student) throw new AppError("Leitor não encontrado.", 404);

  const book = await booksRepository.findById(bookId);
  if (!book) throw new AppError("Livro não encontrado.", 404);

  return repository.createLoan(createdByUserId, studentId, bookId, days);
}

async function returnBook(loanId: string): Promise<Loan> {
  return repository.returnLoan(loanId);
}

async function findAll(
  opts: { page?: string; limit?: string } = {},
): Promise<LoanWithDetails[]> {
  const page = validatePaginationNumber(opts.page, "page", 1);
  const limit = validatePaginationNumber(opts.limit, "limit", 20);
  return repository.findAll({ limit, offset: (page - 1) * limit });
}

const loan = { borrow, returnBook, findAll };
export default loan;
