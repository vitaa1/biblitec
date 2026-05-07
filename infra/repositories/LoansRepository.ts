import database from "infra/database";
import { AppError } from "infra/errors";

export interface Loan {
  id: string;
  student_id: string;
  created_by_user_id: string;
  book_id: string;
  loaned_at: string;
  due_date: string;
  returned_at: string | null;
  status: "ACTIVE" | "RETURNED" | "OVERDUE";
}

export interface LoanWithDetails extends Loan {
  title: string;
  author: string;
  student_name: string;
  registration: string;
  created_by_name: string;
  created_by_email: string;
}

export class LoansRepository {
  async createLoan(
    createdByUserId: string,
    studentId: string,
    bookId: string,
    dueDays: number,
  ): Promise<Loan> {
    const client = await database.getNewClient();

    try {
      await client.query("BEGIN");

      const bookRes = await client.query({
        text: "SELECT available_quantity FROM books WHERE id = $1 FOR UPDATE",
        values: [bookId],
      });

      if (!bookRes.rows.length)
        throw new AppError("Livro não encontrado.", 404);
      if (bookRes.rows[0].available_quantity <= 0) {
        throw new AppError("Nenhum exemplar disponivel para empréstimo.", 409);
      }

      const duplicate = await client.query({
        text: `SELECT id FROM loans WHERE student_id = $1 AND book_id = $2 AND returned_at IS NULL`,
        values: [studentId, bookId],
      });

      if (duplicate.rows.length) {
        throw new AppError("Você ja possui este livro emprestado.", 409);
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

  async returnLoan(loanId: string): Promise<Loan> {
    const client = await database.getNewClient();

    try {
      await client.query("BEGIN");

      const loansRes = await client.query({
        text: `SELECT * FROM loans WHERE id = $1 AND returned_at IS NULL`,
        values: [loanId],
      });

      if (!loansRes.rows.length) {
        throw new AppError("Emprestimo não encontrado ou já devolvido", 404);
      }

      const loan: Loan = loansRes.rows[0];

      const updated = await client.query({
        text: `UPDATE loans SET returned_at = NOW(), status = 'RETURNED' WHERE id = $1 RETURNING *`,
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

  async findAll({
    limit = 20,
    offset = 0,
  }: {
    limit?: number;
    offset?: number;
  }): Promise<LoanWithDetails[]> {
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
