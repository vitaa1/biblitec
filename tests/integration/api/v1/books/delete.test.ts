import database from "infra/database";

beforeEach(cleanDatabase);
async function cleanDatabase() {
  await database.query({
    text: "TRUNCATE TABLE emprestimos, livros, leitores, usuarios CASCADE;",
  });
}

async function createUserAndLogin(): Promise<string> {
  await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome: "Test User",
      email: "test@gmail.com",
      senha: "senha123",
    }),
  });

  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@gmail.com", password: "senha123" }),
  });

  const rawCookie = loginRes.headers.get("set-cookie");
  if (!rawCookie) throw new Error("Login falhou: cookie não retornado");
  return rawCookie.split(";")[0].trim();
}

async function createBook(cookie: string) {
  const res = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      titulo: "Clean Code",
      autor: "Robert Martin",
      isbn: "978-0132350884",
      ano: 2008,
      quantidade: 3,
    }),
  });
  if (!res.ok) throw new Error(`Falha ao criar livro: ${res.status}`);
  return res.json();
}

async function createStudent(cookie: string) {
  const res = await fetch("http://localhost:3000/api/v1/students", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ nome: "Ana Lúcia", matricula: "20240001" }),
  });
  if (!res.ok) throw new Error(`Falha ao criar leitor: ${res.status}`);
  return res.json();
}

test("DELETE /api/v1/books/:id should remove a book and return 204", async () => {
  const cookie = await createUserAndLogin();
  const book = await createBook(cookie);

  const response = await fetch(
    `http://localhost:3000/api/v1/books/${book.id}`,
    { method: "DELETE", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(204);

  const getResponse = await fetch(
    `http://localhost:3000/api/v1/books/${book.id}`,
  );
  expect(getResponse.status).toBe(404);
});

test("DELETE /api/v1/books/:id with nonexistent id should return 404", async () => {
  const cookie = await createUserAndLogin();

  const response = await fetch(
    "http://localhost:3000/api/v1/books/00000000-0000-0000-0000-000000000000",
    { method: "DELETE", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(404);
});

test("DELETE /api/v1/books/:id already deleted should return 404", async () => {
  const cookie = await createUserAndLogin();
  const book = await createBook(cookie);

  await fetch(`http://localhost:3000/api/v1/books/${book.id}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });

  const response = await fetch(
    `http://localhost:3000/api/v1/books/${book.id}`,
    { method: "DELETE", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(404);
});

test("DELETE /api/v1/books/:id with active loan should return 409", async () => {
  const cookie = await createUserAndLogin();
  const book = await createBook(cookie);
  const student = await createStudent(cookie);

  await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      livro_id: book.id,
      leitor_id: student.id,
      dias_prazo: 14,
    }),
  });

  const response = await fetch(
    `http://localhost:3000/api/v1/books/${book.id}`,
    { method: "DELETE", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(409);
  const body = await response.json();
  expect(body.error).toMatch(/empréstimos em aberto/);
});
