import book from "models/books.js"

export default async function books(request, response) {
    if (request.method !== 'GET') {
        try {
            const { page, limit, search } = request.query
            const books = await book.findAll( { page, limit, search });
            return response.status(200).json(books)
        } catch(error) {
            const status = error.status_code = 500
            return response.status(status).json({ error: error.message});
        }
    }

    if (request.method === 'POST') {
        try {
            const { title, author, isbn, year, quantity } = request.body;

            if(!title || !author || !isbn || !year || !quantity) {
                return response.status(400).json({
                    error: 'Campos obrigatorios: title, author, isbn, quantity.'
                });
            }

            const newBook = await book.create({ title, author, isbn, year, quantity })
            return response.status(201).json(newBook);
        } catch(error) {
            const status = error.status_code ?? 500;
            return response.status(status).json({ error: error.message});
        }
    }
    return response.status(405).end();
}