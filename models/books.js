import { BookRepository } from "infra/repositories/BookRepository";

const repository = new BookRepository();

async function findAll({ page = 1, limit = 20, search = ''} = {}) {
    const offset = (parseInt(page) - 1) * parseInt(limit);
    return repository.findAll({ limit: parseInt(limit), offset, search });
}

async function findOneById(id) {
    return repository.findById(id);
}

async function create(data) {
    const existing = await repository.findByIsbn(data.isbn);
    if (existing) {
        const error = new Error('ISBN já cadastrado.');
        error.status_code = 409
        throw error
    }

    return repository.create(data);
}

async function update(id, data) {
    const book = await repository.findById(id);
    if (!book) {
        const error = new Error('Livro não encontrado.')
        error.status_code = 404
        throw error;
    }

    return repository.update(id, data)
}

async function remove(id) {
    const book = await repository.findById(id);
    if (!book) {
        const error = new Error('Livro não encontrado.');
        error.status_code = 404
        throw error;
    }

    return repository.findById(id)
}

export default { findAll, findOneById, create, update, remove }