import { DatabaseError } from "pg";
import database from "infra/database";
import { AppError } from "infra/errors";

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  year: number | null;
  quantity: number;
  available_quantity: number;
  created_at: string;
}

export class BookRepository {
  async findAll({
    limit = 20,
    offset = 0,
    search = "",
  }: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<Book[]> {
    const { rows } = await database.query({
      text: `
        SELECT id, title, author, isbn, year, quantity, available_quantity, created_at
        FROM books
        WHERE deleted_at IS NULL
          AND ($1 = '' OR title ILIKE '%' || $1 || '%'
                       OR author ILIKE '%' || $1 || '%'
                       OR isbn ILIKE '%' || $1 || '%')
        ORDER BY title ASC
        LIMIT $2 OFFSET $3
      `,
      values: [search, limit, offset],
    });
    return rows;
  }

  async findById(id: string): Promise<Book | null> {
    const { rows } = await database.query({
      text: "SELECT * FROM books WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
      values: [id],
    });
    return rows[0] ?? null;
  }

  async findByIsbn(isbn: string): Promise<Book | null> {
    const { rows } = await database.query({
      text: "SELECT * FROM books WHERE isbn = $1 AND deleted_at IS NULL LIMIT 1",
      values: [isbn],
    });
    return rows[0] ?? null;
  }

  async create(data: {
    title: string;
    author: string;
    isbn: string;
    year?: number | null;
    quantity: number;
  }): Promise<Book> {
    const { rows } = await database.query({
      text: `
        INSERT INTO books (title, author, isbn, year, quantity, available_quantity)
        VALUES ($1, $2, $3, $4, $5, $5)
        RETURNING *
      `,
      values: [
        data.title,
        data.author,
        data.isbn,
        data.year ?? null,
        data.quantity,
      ],
    });
    return rows[0];
  }

  async update(
    id: string,
    data: Partial<{
      title: string;
      author: string;
      isbn: string;
      year: number;
      quantity: number;
      available_quantity: number;
    }>,
  ): Promise<Book> {
    const currentBook = await this.findById(id);
    if (!currentBook) throw new AppError("Livro não encontrado.", 404);

    if (data.quantity !== undefined) {
      const borrowedQuantity =
        currentBook.quantity - currentBook.available_quantity;
      if (data.quantity < borrowedQuantity) {
        throw new AppError(
          "Quantidade não pode ser menor que o número de livros emprestados.",
          409,
        );
      }
      data.available_quantity = data.quantity - borrowedQuantity;
    }

    const fields = [
      "title",
      "author",
      "isbn",
      "year",
      "quantity",
      "available_quantity",
    ] as const;
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${values.length + 1}`);
        values.push(data[field]);
      }
    }

    values.push(id);
    const { rows } = await database.query({
      text: `UPDATE books SET ${updates.join(", ")} WHERE id = $${values.length} AND deleted_at IS NULL RETURNING *`,
      values,
    });
    return rows[0];
  }

  async delete(id: string): Promise<Book> {
    try {
      const { rows } = await database.query({
        text: "UPDATE books SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING *",
        values: [id],
      });
      if (!rows[0]) throw new AppError("Livro não encontrado.", 404);
      return rows[0];
    } catch (error) {
      if (error instanceof DatabaseError && error.code === "23503") {
        throw new AppError(
          "Livro possui empréstimos vinculados e não pode ser removido.",
          409,
        );
      }
      throw error;
    }
  }
}
