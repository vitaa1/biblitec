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

async function createStudent(cookie: string): Promise<string> {
  const res = await fetch("http://localhost:3000/api/v1/students", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ name: "Aluno Teste", registration: "MAT-001" }),
  });
  const body = await res.json();
  return body.id;
}

test("POST /api/v1/loans should create loan and return 201", async () => {
  const cookie = await createUserAndLogin();
  const bookId = await createBook(cookie);
  const studentId = await createStudent(cookie);

  const response = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ student_id: studentId, book_id: bookId, due_days: 14 }),
  });

  expect(response.status).toBe(201);

  const body = await response.json();
  expect(body.book_id).toBe(bookId);
  expect(body.student_id).toBe(studentId);
  expect(body.returned_at).toBeNull();
  expect(body.due_date).toBeDefined();
});

test("POST /api/v1/loans without auth should return 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: "1", book_id: "1", due_days: 7 }),
  });

  expect(response.status).toBe(401);
});

test("POST /api/v1/loans with unavailable book should return 409", async () => {
  const cookie = await createUserAndLogin();
  const studentId = await createStudent(cookie);

  const res = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      title: "Raro",
      author: "Autor X",
      isbn: "9788575226325",
      year: 2020,
      quantity: 1,
    }),
  });
  const { id: bookId } = await res.json();

  await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ student_id: studentId, book_id: bookId, due_days: 7 }),
  });

  const response = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ student_id: studentId, book_id: bookId, due_days: 7 }),
  });

  expect(response.status).toBe(409);
});
