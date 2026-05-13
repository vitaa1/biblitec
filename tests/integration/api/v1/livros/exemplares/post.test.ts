import {
  criarExemplar,
  criarGiroteca,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let livroId: string;
let girotecaAId: string;

beforeEach(async () => {
  await limparBanco();
  const girotecaA = await criarGiroteca({ codigo: "GA02", nome: "Giroteca A" });
  girotecaAId = girotecaA.id;
  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
  const livro = await criarLivro();
  livroId = livro.id;
});

test("POST /api/v1/livros/[id]/exemplares cria exemplar e retorna 201", async () => {
  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ codigoTombamento: "001", estado: "bom" }),
    },
  );

  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.codigoTombamento).toBe("001");
  expect(body.girotecaId).toBe(girotecaAId);
  expect(body.status).toBe("disponivel");
});

test("POST código de tombamento duplicado na mesma giroteca retorna 409", async () => {
  await criarExemplar(livroId, girotecaAId, { codigoTombamento: "001" });

  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ codigoTombamento: "001" }),
    },
  );

  expect(response.status).toBe(409);
  const body = await response.json();
  expect(body.error).toContain("Já existe");
});

test("POST sem codigoTombamento retorna 400", async () => {
  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ estado: "bom" }),
    },
  );

  expect(response.status).toBe(400);
});

test("POST sem auth retorna 401", async () => {
  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigoTombamento: "001" }),
    },
  );

  expect(response.status).toBe(401);
});

test("POST admin_nthe sem girotecaId retorna 403", async () => {
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
  const adminCookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();

  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livroId}/exemplares`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ codigoTombamento: "001" }),
    },
  );

  expect(response.status).toBe(403);
});
