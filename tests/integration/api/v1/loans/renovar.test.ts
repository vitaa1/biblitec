import {
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";
import { db } from "db/index";
import { emprestimos as empTable } from "db/schema";
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

async function criarEmprestimoViaApi() {
  const res = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });
  return res.json() as Promise<{
    id: string;
    renovacoes: number;
    dataPrevistaDevolucao: string;
  }>;
}

test("POST /api/v1/loans/:id/renovar renova e retorna 200 com nova data", async () => {
  const loan = await criarEmprestimoViaApi();

  const res = await fetch(
    `http://localhost:3000/api/v1/loans/${loan.id}/renovar`,
    { method: "POST", headers: { Cookie: cookie } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.renovacoes).toBe(1);
  const novaData = new Date(body.dataPrevistaDevolucao);
  const dataOriginal = new Date(loan.dataPrevistaDevolucao);
  expect(novaData.getTime()).toBeGreaterThan(dataOriginal.getTime());
});

test("POST /api/v1/loans/:id/renovar sem auth retorna 401", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/loans/00000000-0000-0000-0000-000000000000/renovar",
    { method: "POST" },
  );
  expect(res.status).toBe(401);
});

test("POST /api/v1/loans/:id/renovar empréstimo inexistente retorna 404", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/loans/00000000-0000-0000-0000-000000000000/renovar",
    { method: "POST", headers: { Cookie: cookie } },
  );
  expect(res.status).toBe(404);
});

test("POST /api/v1/loans/:id/renovar limite de renovações retorna 409", async () => {
  const loan = await criarEmprestimoViaApi();

  // Força renovacoes = MAX_RENOVACOES (2)
  await db
    .update(empTable)
    .set({ renovacoes: 2 })
    .where(eq(empTable.id, loan.id));

  const res = await fetch(
    `http://localhost:3000/api/v1/loans/${loan.id}/renovar`,
    { method: "POST", headers: { Cookie: cookie } },
  );
  expect(res.status).toBe(409);
});

test("POST /api/v1/loans/:id/renovar empréstimo em atraso retorna 409", async () => {
  const loan = await criarEmprestimoViaApi();

  await db
    .update(empTable)
    .set({ dataPrevistaDevolucao: new Date("2000-01-01") })
    .where(eq(empTable.id, loan.id));

  const res = await fetch(
    `http://localhost:3000/api/v1/loans/${loan.id}/renovar`,
    { method: "POST", headers: { Cookie: cookie } },
  );
  expect(res.status).toBe(409);
});

test("POST /api/v1/loans/:id/renovar gestor de outra giroteca retorna 403", async () => {
  const loan = await criarEmprestimoViaApi();

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

  const res = await fetch(
    `http://localhost:3000/api/v1/loans/${loan.id}/renovar`,
    { method: "POST", headers: { Cookie: cookieB } },
  );
  expect(res.status).toBe(403);
});
