import { db } from "db/index";
import { emprestimos } from "db/schema";
import {
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;

beforeEach(async () => {
  await limparBanco();
  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

async function criarLivroViaApi(c: string) {
  const res = await fetch("http://localhost:3000/api/v1/livros", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: c },
    body: JSON.stringify({ titulo: "Clean Code", autores: "Robert Martin" }),
  });
  if (!res.ok) throw new Error(`Falha ao criar livro: ${res.status}`);
  return res.json();
}

test("DELETE /api/v1/livros/:id remove livro e retorna 204", async () => {
  const livro = await criarLivroViaApi(cookie);

  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livro.id}`,
    { method: "DELETE", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(204);

  const getRes = await fetch(`http://localhost:3000/api/v1/livros/${livro.id}`, {
    headers: { Cookie: cookie },
  });
  expect(getRes.status).toBe(404);
});

test("DELETE /api/v1/livros/:id livro inexistente retorna 404", async () => {
  const response = await fetch(
    "http://localhost:3000/api/v1/livros/00000000-0000-0000-0000-000000000000",
    { method: "DELETE", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(404);
});

test("DELETE /api/v1/livros/:id já deletado retorna 404", async () => {
  const livro = await criarLivroViaApi(cookie);

  await fetch(`http://localhost:3000/api/v1/livros/${livro.id}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });

  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livro.id}`,
    { method: "DELETE", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(404);
});

test("DELETE /api/v1/livros/:id com empréstimo ativo retorna 409", async () => {
  const giroteca = await criarGiroteca();
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, giroteca.id);
  const leitor = await criarLeitor(giroteca.id);
  const registrador = await criarUsuario({
    papel: "admin_nthe",
    girotecaId: null,
  });

  await db.insert(emprestimos).values({
    exemplarId: exemplar.id,
    leitorId: leitor.id,
    registradoPorId: registrador.id,
    dataPrevistaDevolucao: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });

  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livro.id}`,
    { method: "DELETE", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(409);

  const body = await response.json();
  expect(body.error).toMatch(/empréstimos em aberto/);
});
