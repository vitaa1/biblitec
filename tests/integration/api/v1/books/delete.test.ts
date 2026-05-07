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

  const cookie = loginRes.headers.get("set-cookie");
  if (!cookie) throw new Error("Login falhou: cookie não retornado");
  return cookie;
}

test("DELETE /api/v1/books/:id should remove a book and return 204", async () => {
  const cookie = await createUserAndLogin();

  const createResponse = await fetch("http://localhost:3000/api/v1/books", {
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
  const createdBook = await createResponse.json();

  const response = await fetch(
    `http://localhost:3000/api/v1/books/${createdBook.id}`,
    { method: "DELETE", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(204);

  const getResponse = await fetch(
    `http://localhost:3000/api/v1/books/${createdBook.id}`,
  );
  expect(getResponse.status).toBe(404);
});
