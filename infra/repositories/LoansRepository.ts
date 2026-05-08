import database from "infra/database";
import { AppError } from "infra/errors";

export interface Loan {
  id: string;
  leitor_id: string;
  criado_por_usuario_id: string;
  livro_id: string;
  emprestado_em: string;
  data_devolucao: string;
  devolvido_em: string | null;
  status: "ACTIVE" | "RETURNED" | "OVERDUE";
}

export interface LoanWithDetails extends Loan {
  titulo: string;
  autor: string;
  nome_leitor: string;
  matricula: string;
  nome_criado_por: string;
  email_criado_por: string;
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
        text: "SELECT quantidade_disponivel FROM livros WHERE id = $1 FOR UPDATE",
        values: [bookId],
      });

      if (!bookRes.rows.length)
        throw new AppError("Livro não encontrado.", 404);
      if (bookRes.rows[0].quantidade_disponivel <= 0) {
        throw new AppError("Nenhum exemplar disponível para empréstimo.", 409);
      }

      const duplicate = await client.query({
        text: `SELECT id FROM emprestimos WHERE leitor_id = $1 AND livro_id = $2 AND devolvido_em IS NULL`,
        values: [studentId, bookId],
      });

      if (duplicate.rows.length) {
        throw new AppError("Você já possui este livro emprestado.", 409);
      }

      const loansRes = await client.query({
        text: `INSERT INTO emprestimos (leitor_id, criado_por_usuario_id, livro_id, data_devolucao)
               VALUES ($1, $2, $3, NOW() + make_interval(days => $4))
               RETURNING *`,
        values: [studentId, createdByUserId, bookId, dueDays],
      });

      await client.query({
        text: "UPDATE livros SET quantidade_disponivel = quantidade_disponivel - 1 WHERE id = $1",
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
        text: `SELECT * FROM emprestimos WHERE id = $1 AND devolvido_em IS NULL`,
        values: [loanId],
      });

      if (!loansRes.rows.length) {
        throw new AppError("Emprestimo não encontrado ou já devolvido", 404);
      }

      const loan: Loan = loansRes.rows[0];

      const updated = await client.query({
        text: `UPDATE emprestimos SET devolvido_em = NOW(), status = 'RETURNED' WHERE id = $1 RETURNING *`,
        values: [loanId],
      });

      await client.query({
        text: "UPDATE livros SET quantidade_disponivel = quantidade_disponivel + 1 WHERE id = $1",
        values: [loan.livro_id],
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
          b.titulo,
          b.autor,
          s.nome AS nome_leitor,
          s.matricula,
          u.nome AS nome_criado_por,
          u.email AS email_criado_por
        FROM emprestimos l
        JOIN livros b ON l.livro_id = b.id
        JOIN leitores s ON l.leitor_id = s.id
        JOIN usuarios u ON l.criado_por_usuario_id = u.id
        ORDER BY l.emprestado_em DESC
        LIMIT $1 OFFSET $2
      `,
      values: [limit, offset],
    });
    return rows;
  }
}
