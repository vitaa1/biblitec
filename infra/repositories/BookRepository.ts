import database from "infra/database";
import { AppError } from "infra/errors";

export interface Book {
  id: string;
  titulo: string;
  autor: string;
  isbn: string;
  ano: number | null;
  quantidade: number;
  quantidade_disponivel: number;
  criado_em: string;
}

const BOOK_COLUMNS =
  "id, titulo, autor, isbn, ano, quantidade, quantidade_disponivel, criado_em";

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
        SELECT ${BOOK_COLUMNS}
        FROM livros
        WHERE deletado_em IS NULL
          AND ($1 = '' OR titulo ILIKE '%' || $1 || '%'
                       OR autor ILIKE '%' || $1 || '%'
                       OR isbn ILIKE '%' || $1 || '%')
        ORDER BY titulo ASC
        LIMIT $2 OFFSET $3
      `,
      values: [search, limit, offset],
    });
    return rows;
  }

  async findById(id: string): Promise<Book | null> {
    const { rows } = await database.query({
      text: `SELECT ${BOOK_COLUMNS} FROM livros WHERE id = $1 AND deletado_em IS NULL LIMIT 1`,
      values: [id],
    });
    return rows[0] ?? null;
  }

  async findByIsbn(isbn: string): Promise<Book | null> {
    const { rows } = await database.query({
      text: `SELECT ${BOOK_COLUMNS} FROM livros WHERE isbn = $1 AND deletado_em IS NULL LIMIT 1`,
      values: [isbn],
    });
    return rows[0] ?? null;
  }

  async create(data: {
    titulo: string;
    autor: string;
    isbn: string;
    ano?: number | null;
    quantidade: number;
  }): Promise<Book> {
    const { rows } = await database.query({
      text: `
        INSERT INTO livros (titulo, autor, isbn, ano, quantidade, quantidade_disponivel)
        VALUES ($1, $2, $3, $4, $5, $5)
        RETURNING ${BOOK_COLUMNS}
      `,
      values: [
        data.titulo,
        data.autor,
        data.isbn,
        data.ano ?? null,
        data.quantidade,
      ],
    });
    return rows[0];
  }

  async update(
    id: string,
    data: Partial<{
      titulo: string;
      autor: string;
      isbn: string;
      ano: number;
      quantidade: number;
      quantidade_disponivel: number;
    }>,
  ): Promise<Book> {
    const currentBook = await this.findById(id);
    if (!currentBook) throw new AppError("Livro não encontrado.", 404);

    if (data.quantidade !== undefined) {
      const borrowedQuantity =
        currentBook.quantidade - currentBook.quantidade_disponivel;
      if (data.quantidade < borrowedQuantity) {
        throw new AppError(
          "Quantidade não pode ser menor que o número de livros emprestados.",
          409,
        );
      }
      data = {
        ...data,
        quantidade_disponivel: data.quantidade - borrowedQuantity,
      };
    }

    const fields = [
      "titulo",
      "autor",
      "isbn",
      "ano",
      "quantidade",
      "quantidade_disponivel",
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
      text: `UPDATE livros SET ${updates.join(", ")} WHERE id = $${values.length} AND deletado_em IS NULL RETURNING ${BOOK_COLUMNS}`,
      values,
    });
    return rows[0];
  }

  async delete(id: string): Promise<Book> {
    const { rows } = await database.query({
      text: `
        UPDATE livros
        SET deletado_em = NOW()
        WHERE id = $1
          AND deletado_em IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM emprestimos
            WHERE livro_id = $1 AND devolvido_em IS NULL
          )
        RETURNING ${BOOK_COLUMNS}
      `,
      values: [id],
    });

    if (!rows[0]) {
      const { rows: found } = await database.query({
        text: "SELECT 1 FROM livros WHERE id = $1 AND deletado_em IS NULL LIMIT 1",
        values: [id],
      });
      if (!found.length) throw new AppError("Livro não encontrado.", 404);
      throw new AppError(
        "Livro possui empréstimos em aberto e não pode ser removido.",
        409,
      );
    }

    return rows[0];
  }
}
