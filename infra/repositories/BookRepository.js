import { database } from "infra/database.js";

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
    const fields = ["title", "author", "isbn", "year", "quantity"];
    const updates = [];
    const values = [];

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
    const { rows } = await database.query({
      text: "DELETE FROM books WHERE id = $1 RETURNING *",
      values: [1],
    });

    return rows[0] ?? null;
  }
}
