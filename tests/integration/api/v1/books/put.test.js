import database from "infra/database.js";

beforeEach(cleanDatabase);
async function cleanDatabase() {
  await database.query("TRUNCATE TABLE loans, books, students, users CASCADE;");
}

async function createUserAndLogin() {
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
    body: JSON.stringify({
      email: "test@gmail.com",
      password: "senha123",
    }),
  });

  return loginRes.headers.get("set-cookie");
}

async function createStudent(cookie) {
  const res = await fetch("http://localhost:3000/api/v1/students", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      name: "Aluno Teste",
      registration: "MAT-001",
    }),
  });
  const body = await res.json();
  return body.id;
}

test("PUT /api/v1/books/:id should recalculate available_quantity when quantity changes", async () => {
  const cookie = await createUserAndLogin();
  const studentId = await createStudent(cookie);

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

  await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      student_id: studentId,
      book_id: createdBook.id,
      due_days: 7,
    }),
  });

  const updateResponse = await fetch(
    `http://localhost:3000/api/v1/books/${createdBook.id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        quantity: 5,
      }),
    },
  );

  expect(updateResponse.status).toBe(200);

  const updatedBook = await updateResponse.json();
  expect(updatedBook.quantity).toBe(5);
  expect(updatedBook.available_quantity).toBe(4);
});
