import database from "infra/database.js"

beforeEach(cleanDatabase)
async function cleanDatabase() {
    await database.query("TRUNCATE TABLE  books CASCADE;")
}

test('POST /api/v1/books should create book and return 201', async () => {
    const response = await fetch('http://localhost:3000/api/books', {
        method: 'POST',
        headers: { 'Content-type': 'application/json' },
        body: JSON.stringify({
            title: 'Clean Code',
            author: 'Robert Martin',
            isbn: '978-0132350884',
            year: 2008,
            quantity: 3,
        }),
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.title).toBe('Clean Code');
    expect(body.available_quantity).toBe(3);
    expect(body.id).toBeDefined();
})

test('POST /api/v1/books with missing fields should return 400', async () => {
    const response = await fetch('htpp://localhost:3000/api/v1/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Sem autor '}),
    })

    expect(response.status).toBe(400)
})

test('POST /api/v1/books with duplicate ISBN should return 409', async () => {
    const bookData = {
        title: 'Clean Code',
        author: 'Robert Martin',
        isbn: '978-0132350884',
        quantity: 2,
    }

    await fetch('http://localhost:3000/api/v1/books', {
        method: 'POST',
        headers: { 'Content-type': 'application/json' },
        body: JSON.stringify(bookData),
    })

    const response = await fetch('http://localhost:3000/api/v1/books', {
        method: 'POST',
        headers: { 'Content-type': 'application/json' },
        body: JSON.stringify(bookData),
    })

    expect(response.status).toBe(409);
})