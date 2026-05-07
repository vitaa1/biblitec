import { AppError } from "infra/errors";
import { BookRepository, type Book } from "infra/repositories/BookRepository";

export type { Book };

const repository = new BookRepository();

function validatePaginationNumber(
  value: string | undefined,
  fieldName: string,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(
      `${fieldName} deve ser um número inteiro positivo.`,
      400,
    );
  }
  return parsed;
}

function validateBookData(
  data: Record<string, unknown>,
  options: { partial?: boolean } = {},
): Partial<{
  title: string;
  author: string;
  isbn: string;
  year: number;
  quantity: number;
}> {
  const { partial = false } = options;
  const validated: ReturnType<typeof validateBookData> = {};
  const currentYear = new Date().getFullYear() + 1;

  if (!partial || data.title !== undefined) {
    if (typeof data.title !== "string" || data.title.trim().length < 2) {
      throw new AppError("Título deve ter pelo menos 2 caracteres.", 400);
    }
    validated.title = data.title.trim();
  }

  if (!partial || data.author !== undefined) {
    if (typeof data.author !== "string" || data.author.trim().length < 2) {
      throw new AppError("Autor deve ter pelo menos 2 caracteres.", 400);
    }
    validated.author = data.author.trim();
  }

  if (!partial || data.isbn !== undefined) {
    const normalizedIsbn = String(data.isbn ?? "")
      .replace(/[^0-9Xx]/g, "")
      .toUpperCase();
    if (![10, 13].includes(normalizedIsbn.length)) {
      throw new AppError("ISBN deve conter 10 ou 13 caracteres válidos.", 400);
    }
    validated.isbn = normalizedIsbn;
  }

  if (!partial || data.year !== undefined) {
    const parsedYear = Number.parseInt(String(data.year), 10);
    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < 1000 ||
      parsedYear > currentYear
    ) {
      throw new AppError("Ano informado é inválido.", 400);
    }
    validated.year = parsedYear;
  }

  if (!partial || data.quantity !== undefined) {
    const parsedQuantity = Number.parseInt(String(data.quantity), 10);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      throw new AppError(
        "Quantidade deve ser um número inteiro maior que zero.",
        400,
      );
    }
    validated.quantity = parsedQuantity;
  }

  return validated;
}

async function findAll(
  opts: {
    page?: string;
    limit?: string;
    search?: string;
  } = {},
): Promise<Book[]> {
  const page = validatePaginationNumber(opts.page, "page", 1);
  const limit = validatePaginationNumber(opts.limit, "limit", 20);
  return repository.findAll({
    limit,
    offset: (page - 1) * limit,
    search: opts.search?.trim() ?? "",
  });
}

async function findOneById(id: string): Promise<Book | null> {
  return repository.findById(id);
}

async function create(data: Record<string, unknown>): Promise<Book> {
  const validated = validateBookData(data) as Required<
    ReturnType<typeof validateBookData>
  >;

  const existing = await repository.findByIsbn(validated.isbn);
  if (existing) throw new AppError("ISBN já cadastrado.", 409);

  return repository.create(validated);
}

async function update(
  id: string,
  data: Record<string, unknown>,
): Promise<Book> {
  const existing = await repository.findById(id);
  if (!existing) throw new AppError("Livro não encontrado.", 404);

  const validated = validateBookData(data, { partial: true });
  if (Object.keys(validated).length === 0) {
    throw new AppError("Informe ao menos um campo para atualização.", 400);
  }

  if (validated.isbn && validated.isbn !== existing.isbn) {
    const conflict = await repository.findByIsbn(validated.isbn);
    if (conflict) throw new AppError("ISBN já cadastrado.", 409);
  }

  return repository.update(id, validated);
}

async function remove(id: string): Promise<Book> {
  const existing = await repository.findById(id);
  if (!existing) throw new AppError("Livro não encontrado.", 404);
  return repository.delete(id);
}

const book = { findAll, findOneById, create, update, remove };
export default book;
