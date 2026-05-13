import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

let adminCookie: string;
let gestorCookie: string;

beforeEach(async () => {
  await limparBanco();
  const giroteca = await criarGiroteca();

  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });

  const loginAdmin = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  adminCookie = loginAdmin.headers.get("set-cookie")!.split(";")[0];

  const loginGestor = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  gestorCookie = loginGestor.headers.get("set-cookie")!.split(";")[0];
});

async function criarLivro(cookie: string, extra: Record<string, unknown> = {}) {
  const res = await fetch("http://localhost:3000/api/v1/livros", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ titulo: "Livro Teste", autores: "Autor", ...extra }),
  });
  return res;
}

test("gestor cria livro → origem 'local'", async () => {
  const res = await criarLivro(gestorCookie);
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.origem).toBe("local");
});

test("admin NTE cria livro → origem 'central'", async () => {
  const res = await criarLivro(adminCookie);
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.origem).toBe("central");
});

test("POST /api/v1/livros ISBN com formato inválido retorna 400", async () => {
  const res = await criarLivro(adminCookie, { isbn: "123" });
  expect(res.status).toBe(400);
});

test("gestor tenta editar livro central → 403", async () => {
  // Admin cria livro central
  const criado = await (await criarLivro(adminCookie)).json();

  // Gestor tenta editar
  const res = await fetch(`http://localhost:3000/api/v1/livros/${criado.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({ titulo: "Título alterado" }),
  });
  expect(res.status).toBe(403);
});

test("POST /api/v1/livros sem título retorna 400", async () => {
  const res = await fetch("http://localhost:3000/api/v1/livros", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ autores: "Autor" }),
  });
  expect(res.status).toBe(400);
});
