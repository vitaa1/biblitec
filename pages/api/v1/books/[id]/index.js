import book from "models/books.js";

export default async function bookById(request, response) {
  const { id } = request.query;

  if (request.method === "GET") {
    try {
      const found = await book.findOneById(id);
      if (!found)
        return response.status(404).json({ error: "Livro não encontrado" });
      return response.status(200).json(found);
    } catch (error) {
      const status = error.status_code ?? 500;
      return response.status(status).json({ error: error.message });
    }
  }

  if (request.method === "PUT") {
    try {
      const { title, author, isbn, year, quantity } = request.body;
      const updated = await book.update(id, {
        title,
        author,
        isbn,
        year,
        quantity,
      });
      return response.status(200).json(updated);
    } catch (error) {
      const status = error.status_code ?? 500;
      return response.status(status).json({ error: error.message });
    }
  }

  if (request.method === "DELETE") {
    try {
      await book.remove(id);
      return response.status(204).end();
    } catch (error) {
      const status = error.status_code ?? 500;
      return response.status(status).json({ error: error.message });
    }
  }
  return response.status(405).end();
}
