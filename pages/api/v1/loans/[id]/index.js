import loan from "models/loans.js";

export default async function loanById(request, response) {
  const { id } = request.query;
  const userId = request.headers["x-user-id"];

  if (request.method === "PATCH") {
    try {
      if (!userId) {
        return response.status(401).json({ error: "Não autorizado." });
      }

      const returned = await loan.returnBook(id);
      return response.status(200).json(returned);
    } catch (error) {
      const status = error.status_code ?? 500;
      return response.status(status).json({ error: error.message });
    }
  }

  return response.status(405).end();
}
