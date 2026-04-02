import database from "infra/database.js";

export class LoansRepository {
  async createLoan(createdByUserId, studentId, bookId, dueDays) {
    const client = await database.getNewClient();

    try {
      await client.query("BEGIN");

      const bookRes = await client.query({
        text: "SELECT available_quantity FROM books WHERE id = $1 FOR UPDATE",
        values: [bookId],
      });

      if (!bookRes.rows.length) {
        const error = new Error("Livro não encontrado.");
        error.status_code = 404;
        throw error;
      }

      if (bookRes.rows[0].available_quantity <= 0) {
        const error = new Error("Nenhum exemplar disponivel para empréstimo.");
        error.status_code = 409;
        throw error;
      }

      const duplicate = await client.query({
        text: `SELECT id FROM loans
               WHERE student_id = $1 AND book_id = $2 AND returned_at IS NULL`,
        values: [studentId, bookId],
      });

      if (duplicate.rows.length) {
        const error = new Error("Você ja possui este livro emprestado.");
        error.status_code = 409;
        throw error;
      }

      const loansRes = await client.query({
        text: `INSERT INTO loans (student_id, created_by_user_id, book_id, due_date)
               VALUES ($1, $2, $3, NOW() + make_interval(days => $4))
               RETURNING *`,
        values: [studentId, createdByUserId, bookId, dueDays],
      });

      await client.query({
        text: "UPDATE books SET available_quantity = available_quantity - 1 WHERE id = $1",
        values: [bookId],
      });

      await client.query("COMMIT");
      return loansRes.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      await client.end();
    }
  }

  async returnLoan(loanId) {
    const client = await database.getNewClient();

    try {
      await client.query("BEGIN");

      const loansRes = await client.query({
        text: `SELECT * FROM loans
               WHERE id = $1 AND returned_at IS NULL`,
        values: [loanId],
      });

      if (!loansRes.rows.length) {
        const error = new Error("Emprestimo não encontrado ou já devolvido");
        error.status_code = 404;
        throw error;
      }

      const loan = loansRes.rows[0];

      const updated = await client.query({
        text: `UPDATE loans
               SET returned_at = NOW(), status = 'RETURNED'
               WHERE id = $1 RETURNING *`,
        values: [loanId],
      });

      await client.query({
        text: "UPDATE books SET available_quantity = available_quantity + 1 WHERE id = $1",
        values: [loan.book_id],
      });

      await client.query("COMMIT");
      return updated.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      await client.end();
    }
  }

  async findAll({ limit = 20, offset = 0 }) {
    const { rows } = await database.query({
      text: `
        SELECT
          l.*,
          b.title,
          b.author,
          s.name AS student_name,
          s.registration,
          u.name AS created_by_name,
          u.email AS created_by_email
        FROM loans l
        JOIN books b ON l.book_id = b.id
        JOIN students s ON l.student_id = s.id
        JOIN users u ON l.created_by_user_id = u.id
        ORDER BY l.loaned_at DESC
        LIMIT $1 OFFSET $2
      `,
      values: [limit, offset],
    });
    return rows;
  }
}
