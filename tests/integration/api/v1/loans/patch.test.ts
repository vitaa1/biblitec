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

test("PATCH /api/v1/loans/:id should return a loan and restore stock", async () => {
  const cookie = await createUserAndLogin();
  const studentId = await createStudent(cookie);
  const bookId = await createBook(cookie);

  const loanResponse = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      leitor_id: studentId,
      livro_id: bookId,
      dias_prazo: 7,
    }),
  });
  const loanBody = await loanResponse.json();

  const response = await fetch(
    `http://localhost:3000/api/v1/loans/${loanBody.id}`,
    { method: "PATCH", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(body.devolvido_em).toBeDefined();
  expect(body.status).toBe("RETURNED");

  const bookResponse = await fetch(
    `http://localhost:3000/api/v1/books/${bookId}`,
  );
  const updatedBook = await bookResponse.json();
  expect(updatedBook.quantidade_disponivel).toBe(2);
});
