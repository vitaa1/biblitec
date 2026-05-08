import database from "infra/database";

beforeEach(cleanDatabase);
async function cleanDatabase() {
  await database.query({ text: "TRUNCATE TABLE books, users CASCADE;" });
}

async function createUserAndLogin(): Promise<string> {
  await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email: "test@gmail.com",
      password: "senha123",
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
      title: "Clean Code",
      author: "Robert Martin",
      isbn: "978-0132350884",
      year: 2008,
      quantity: 3,
    }),
  });
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
