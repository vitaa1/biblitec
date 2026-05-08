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

async function createStudent(cookie: string): Promise<string> {
  const res = await fetch("http://localhost:3000/api/v1/students", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ nome: "Aluno Teste", matricula: "MAT-001" }),
  });
  const body = await res.json();
  return body.id;
}

async function createBook(cookie: string): Promise<string> {
  const res = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      titulo: "Clean Code",
      autor: "Robert Martin",
      isbn: "978-0132350884",
      ano: 2008,
      quantidade: 2,
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
    body: JSON.stringify({
      leitor_id: studentId,
      livro_id: bookId,
      dias_prazo: 7,
    }),
  });

  const response = await fetch("http://localhost:3000/api/v1/loans", {
    method: "GET",
    headers: { Cookie: cookie },
  });

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body).toHaveLength(1);
  expect(body[0].leitor_id).toBe(studentId);
  expect(body[0].livro_id).toBe(bookId);
  expect(body[0].nome_leitor).toBe("Aluno Teste");
  expect(body[0].nome_criado_por).toBe("Test User");
});
