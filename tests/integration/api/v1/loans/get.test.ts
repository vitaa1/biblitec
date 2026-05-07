import database from "infra/database";

beforeEach(cleanDatabase);
async function cleanDatabase() {
  await database.query({
    text: "TRUNCATE TABLE loans, books, students, users CASCADE;",
  });
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

async function createStudent(cookie: string): Promise<string> {
  const res = await fetch("http://localhost:3000/api/v1/students", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ name: "Aluno Teste", registration: "MAT-001" }),
  });
  const body = await res.json();
  return body.id;
}

async function createBook(cookie: string): Promise<string> {
  const res = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      title: "Clean Code",
      author: "Robert Martin",
      isbn: "978-0132350884",
      year: 2008,
      quantity: 2,
    }),
  });
  const body = await res.json();
  return body.id;
}

test("GET /api/v1/loans should list registered loans", async () => {
  const cookie = await createUserAndLogin();
  const studentId = await createStudent(cookie);
  const bookId = await createBook(cookie);

  await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ student_id: studentId, book_id: bookId, due_days: 7 }),
  });

  const response = await fetch("http://localhost:3000/api/v1/loans", {
    method: "GET",
    headers: { Cookie: cookie },
  });

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body).toHaveLength(1);
  expect(body[0].student_id).toBe(studentId);
  expect(body[0].book_id).toBe(bookId);
  expect(body[0].student_name).toBe("Aluno Teste");
  expect(body[0].created_by_name).toBe("Test User");
});
