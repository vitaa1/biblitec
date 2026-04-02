import loan from "models/loans.js";

export default async function loans(request, response) {
  const userId = request.headers["x-user-id"];

  if (request.method === "POST") {
    try {
      if (!userId) {
        return response.status(401).json({ error: "Não autorizado." });
      }

      const { student_id, book_id, due_days } = request.body;

      if (!book_id) {
        return response.status(400).json({ error: "book_id é obrigatório" });
      }

      if (!student_id) {
        return response.status(400).json({ error: "student_id é obrigatório" });
      }

      const newLoan = await loan.borrow(userId, student_id, book_id, due_days);
      return response.status(201).json(newLoan);
    } catch (error) {
      const status = error.status_code ?? 500;
      return response.status(status).json({ error: error.message });
    }
  }

  if (request.method === "GET") {
    try {
      if (!userId) {
        return response.status(401).json({ error: "Não autorizado." });
      }

      const { page, limit } = request.query;
      const result = await loan.findAll({ page, limit });
      return response.status(200).json(result);
    } catch (error) {
      return response.status(500).json({ error: "Erro interno do servidor." });
    }
  }

  return response.status(405).end();
}
