import {
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";
import { db } from "db/index";
import { exemplares as exemplaresTbl } from "db/schema";
import { eq } from "drizzle-orm";

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
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
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

test("PATCH /api/v1/loans/:id com estadoRetorno='danificado' atualiza exemplar.estado", async () => {
  const loanRes = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });
  const loan = await loanRes.json();

  const response = await fetch(
    `http://localhost:3000/api/v1/loans/${loan.id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ estadoRetorno: "danificado" }),
    },
  );

  expect(response.status).toBe(200);

  const [exemplar] = await db
    .select()
    .from(exemplaresTbl)
    .where(eq(exemplaresTbl.id, exemplarId));
  expect(exemplar.estado).toBe("danificado");
  expect(exemplar.status).toBe("disponivel");
});

test("PATCH /api/v1/loans/:id sem estadoRetorno não altera exemplar.estado", async () => {
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

  const [exemplar] = await db
    .select()
    .from(exemplaresTbl)
    .where(eq(exemplaresTbl.id, exemplarId));
  expect(exemplar.estado).toBe("bom");
  expect(exemplar.status).toBe("disponivel");
});

test("PATCH /api/v1/loans/:id devolução em atraso retorna 200", async () => {
  const loanRes = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });
  const loan = await loanRes.json();

  const { emprestimos: empTable } = await import("db/schema");
  const { db: dbAtras } = await import("db/index");
  const { eq: eqAtras } = await import("drizzle-orm");
  await dbAtras
    .update(empTable)
    .set({ dataPrevistaDevolucao: new Date("2000-01-01") })
    .where(eqAtras(empTable.id, loan.id));

  const response = await fetch(
    `http://localhost:3000/api/v1/loans/${loan.id}`,
    { method: "PATCH", headers: { Cookie: cookie } },
  );

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.dataDevolucao).not.toBeNull();
});

test("PATCH /api/v1/loans/:id gestor de outra giroteca retorna 403", async () => {
  const loanRes = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });
  const loan = await loanRes.json();

  const outraGiroteca = await criarGiroteca({ codigo: `OUTRA-${Date.now()}` });
  await criarUsuario({
    email: "gestorb@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: outraGiroteca.id,
  });
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestorb@test.com", senha: "senha123" }),
  });
  const cookieB = loginRes.headers.get("set-cookie")!.split(";")[0].trim();

  const response = await fetch(
    `http://localhost:3000/api/v1/loans/${loan.id}`,
    { method: "PATCH", headers: { Cookie: cookieB } },
  );

  expect(response.status).toBe(403);
});
