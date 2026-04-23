import database from "infra/database.js";

export class BookRepository {
  async findAll({ limit = 20, offset = 0, search = "" }) {
    const { rows } = await database.query({
      text: `
        SELECT id, title, author, isbn, year, quantity, available_quantity, created_at
        FROM books
        WHERE ($1 = '' OR title ILIKE '%' || $1 || '%'
                       OR author ILIKE '%' || $1 || '%'
                       OR isbn Ilike '%' || $1 || '%')
        ORDER BY title ASC
        LIMIT $2 OFFSET $3               
      `,
      values: [search, limit, offset],
    });
    return rows;
  }

  async findById(id) {
    const { rows } = await database.query({
      text: "SELECT * FROM books WHERE id = $1 LIMIT 1",
      values: [id],
    });
    return rows[0] ?? null;
  }

  async findByIsbn(isbn) {
    const { rows } = await database.query({
      text: "SELECT * FROM books WHERE isbn = $1 LIMIT 1",
      values: [isbn],
    });
    return rows[0] ?? null;
  }

  async create(data) {
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

  async update(id, data) {
    const currentBook = await this.findById(id);
    if (!currentBook) {
      return null;
    }

    const fields = [
      "title",
      "author",
      "isbn",
      "year",
      "quantity",
      "available_quantity",
    ];
    const updates = [];
    const values = [];

    if (data.quantity !== undefined) {
      const borrowedQuantity =
        currentBook.quantity - currentBook.available_quantity;

      if (data.quantity < borrowedQuantity) {
        const error = new Error(
          "Quantidade não pode ser menor que o número de livros emprestados.",
        );
        error.status_code = 409;
        throw error;
      }

      data.available_quantity = data.quantity - borrowedQuantity;
    }

    fields.forEach((field) => {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${values.length + 1}`);
        values.push(data[field]);
      }
    });

    if (updates.length === 0) return null;

    values.push(id);
    const { rows } = await database.query({
      text: `UPDATE books SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values,
    });
    return rows[0] ?? null;
  }

  async delete(id) {
    try {
      const { rows } = await database.query({
        text: "DELETE FROM books WHERE id = $1 RETURNING *",
        values: [id],
      });
      return rows[0] ?? null;
    } catch (error) {
      if (error.code === "23503") {
        const domainError = new Error(
          "Livro possui empréstimos vinculados e não pode ser removido.",
        );
        domainError.status_code = 409;
        throw domainError;
      }

      throw error;
    }
  }
}
