import { BookRepository } from "infra/repositories/BookRepository";

const repository = new BookRepository();

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

function validateBookData(data, { partial = false } = {}) {
  const validatedData = {};
  const currentYear = new Date().getFullYear() + 1;

  if (!partial || data.title !== undefined) {
    if (typeof data.title !== "string" || data.title.trim().length < 2) {
      const error = new Error("Título deve ter pelo menos 2 caracteres.");
      error.status_code = 400;
      throw error;
    }
    validatedData.title = data.title.trim();
  }

  if (!partial || data.author !== undefined) {
    if (typeof data.author !== "string" || data.author.trim().length < 2) {
      const error = new Error("Autor deve ter pelo menos 2 caracteres.");
      error.status_code = 400;
      throw error;
    }
    validatedData.author = data.author.trim();
  }

  if (!partial || data.isbn !== undefined) {
    const normalizedIsbn = data.isbn?.replace(/[^0-9Xx]/g, "").toUpperCase();

    if (!normalizedIsbn || ![10, 13].includes(normalizedIsbn.length)) {
      const error = new Error("ISBN deve conter 10 ou 13 caracteres válidos.");
      error.status_code = 400;
      throw error;
    }

    validatedData.isbn = normalizedIsbn;
  }

  if (!partial || data.year !== undefined) {
    const parsedYear = Number.parseInt(data.year, 10);

    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < 1000 ||
      parsedYear > currentYear
    ) {
      const error = new Error("Ano informado é inválido.");
      error.status_code = 400;
      throw error;
    }

    validatedData.year = parsedYear;
  }

  if (!partial || data.quantity !== undefined) {
    const parsedQuantity = Number.parseInt(data.quantity, 10);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      const error = new Error(
        "Quantidade deve ser um número inteiro maior que zero.",
      );
      error.status_code = 400;
      throw error;
    }

    validatedData.quantity = parsedQuantity;
  }

  return validatedData;
}

async function findAll({ page = 1, limit = 20, search = "" } = {}) {
  const safePage = validatePaginationNumber(page, "page", 1);
  const safeLimit = validatePaginationNumber(limit, "limit", 20);
  const offset = (safePage - 1) * safeLimit;

  return repository.findAll({
    limit: safeLimit,
    offset,
    search: search?.trim() ?? "",
  });
}

async function findOneById(id) {
  return repository.findById(id);
}

async function create(data) {
  const validatedData = validateBookData(data);
  const existing = await repository.findByIsbn(validatedData.isbn);
  if (existing) {
    const error = new Error("ISBN já cadastrado.");
    error.status_code = 409;
    throw error;
  }

  return repository.create(validatedData);
}

async function update(id, data) {
  const book = await repository.findById(id);
  if (!book) {
    const error = new Error("Livro não encontrado.");
    error.status_code = 404;
    throw error;
  }

  const validatedData = validateBookData(data, { partial: true });

  if (Object.keys(validatedData).length === 0) {
    const error = new Error("Informe ao menos um campo para atualização.");
    error.status_code = 400;
    throw error;
  }

  if (validatedData.isbn && validatedData.isbn !== book.isbn) {
    const existing = await repository.findByIsbn(validatedData.isbn);
    if (existing) {
      const error = new Error("ISBN já cadastrado.");
      error.status_code = 409;
      throw error;
    }
  }

  return repository.update(id, validatedData);
}

async function remove(id) {
  const book = await repository.findById(id);
  if (!book) {
    const error = new Error("Livro não encontrado.");
    error.status_code = 404;
    throw error;
  }

  return repository.delete(id);
}

export default { findAll, findOneById, create, update, remove };
