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

test("PATCH /api/v1/loans/:id devolve empréstimo e retorna 200", async () => {
  const loanRes = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });
  const loan = await loanRes.json();

  const response = await fetch(
    `http://localhost:3000/api/v1/loans/${loan.id}`,
    { method: "PATCH", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(body.dataDevolucao).not.toBeNull();
  expect(body.id).toBe(loan.id);
});

test("PATCH /api/v1/loans/:id empréstimo inexistente retorna 404", async () => {
  const response = await fetch(
    "http://localhost:3000/api/v1/loans/00000000-0000-0000-0000-000000000000",
    { method: "PATCH", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(404);
});

test("PATCH /api/v1/loans/:id sem auth retorna 401", async () => {
  const response = await fetch(
    "http://localhost:3000/api/v1/loans/00000000-0000-0000-0000-000000000000",
    { method: "PATCH" },
  );

  expect(response.status).toBe(401);
});
