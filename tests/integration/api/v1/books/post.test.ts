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

test("POST /api/v1/books should create a book and return 201", async () => {
  const cookie = await createUserAndLogin();

  const response = await fetch("http://localhost:3000/api/v1/books", {
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

  expect(response.status).toBe(201);

  const body = await response.json();
  expect(body.title).toBe("Clean Code");
  expect(body.available_quantity).toBe(3);
  expect(body.id).toBeDefined();
});

test("POST /api/v1/books with missing fields should return 400", async () => {
  const cookie = await createUserAndLogin();

  const response = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ title: "Sem autor " }),
  });

  expect(response.status).toBe(400);
});

test("POST /api/v1/books with duplicate ISBN should return 409", async () => {
  const cookie = await createUserAndLogin();
  const bookData = {
    title: "Clean Code",
    author: "Robert Martin",
    isbn: "978-0132350884",
    year: 2008,
    quantity: 2,
  };

  await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(bookData),
  });

  const response = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(bookData),
  });

  expect(response.status).toBe(409);
});
