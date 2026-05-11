import {
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let exemplarId: string;
let leitorId: string;

beforeEach(async () => {
  await limparBanco();

  const giroteca = await criarGiroteca();
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, giroteca.id);
  const leitor = await criarLeitor(giroteca.id);
  exemplarId = exemplar.id;
  leitorId = leitor.id;

  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("GET /api/v1/loans lista empréstimos em aberto", async () => {
  await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });

  const response = await fetch("http://localhost:3000/api/v1/loans", {
    headers: { Cookie: cookie },
  });

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.length).toBeGreaterThanOrEqual(1);
  expect(body[0].exemplarId).toBe(exemplarId);
  expect(body[0].dataDevolucao).toBeNull();
});

test("GET /api/v1/loans sem auth retorna 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/loans");

  expect(response.status).toBe(401);
});
