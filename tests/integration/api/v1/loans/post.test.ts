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

async function createStudent(cookie: string): Promise<string> {
  const res = await fetch("http://localhost:3000/api/v1/students", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ nome: "Aluno Teste", matricula: "MAT-001" }),
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
    body: JSON.stringify({
      leitor_id: studentId,
      livro_id: bookId,
      dias_prazo: 14,
    }),
  });

  expect(response.status).toBe(201);

  const body = await response.json();
  expect(body.livro_id).toBe(bookId);
  expect(body.leitor_id).toBe(studentId);
  expect(body.devolvido_em).toBeNull();
  expect(body.data_devolucao).toBeDefined();
});

test("POST /api/v1/loans without auth should return 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leitor_id: "1", livro_id: "1", dias_prazo: 7 }),
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
      titulo: "Raro",
      autor: "Autor X",
      isbn: "9788575226325",
      ano: 2020,
      quantidade: 1,
    }),
  });
  const { id: bookId } = await res.json();

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
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      leitor_id: studentId,
      livro_id: bookId,
      dias_prazo: 7,
    }),
  });

  expect(response.status).toBe(409);
});
