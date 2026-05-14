import {
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let gestorCookie: string;
let exemplarId: string;
let leitorId: string;
let girotecaId: string;

beforeEach(async () => {
  await limparBanco();

  const giroteca = await criarGiroteca();
  girotecaId = giroteca.id;
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

  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });
  const loginGestor = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  gestorCookie = loginGestor.headers.get("set-cookie")!.split(";")[0].trim();
});

async function criarCenarioEmprestimo() {
  const livro = await criarLivro({
    titulo: "Dom Casmurro",
    autores: "Machado",
  });
  const exemplar = await criarExemplar(livro.id, girotecaId);
  const leitor = await criarLeitor(girotecaId, { nome: "Ana Lúcia" });
  return { livro, exemplar, leitor };
}

test("POST /api/v1/loans cria empréstimo e retorna 201", async () => {
  const response = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });

  expect(response.status).toBe(201);

  const body = await response.json();
  expect(body.exemplarId).toBe(exemplarId);
  expect(body.leitorId).toBe(leitorId);
  expect(body.dataDevolucao).toBeNull();
  expect(body.dataPrevistaDevolucao).toBeDefined();
});

test("POST /api/v1/loans sem auth retorna 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exemplarId, leitorId }),
  });

  expect(response.status).toBe(401);
});

test("POST /api/v1/loans com exemplar indisponível retorna 409", async () => {
  await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId }),
  });

  const outroLeitor = await criarLeitor(girotecaId);

  const response = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ exemplarId, leitorId: outroLeitor.id }),
  });

  expect(response.status).toBe(409);
});

test("POST /api/v1/loans aceita dataPrevistaDevolucao customizada", async () => {
  const { exemplar, leitor } = await criarCenarioEmprestimo();
  const dataAlvo = new Date();
  dataAlvo.setDate(dataAlvo.getDate() + 30);
  const dataIso = dataAlvo.toISOString().slice(0, 10);

  const res = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({
      exemplarId: exemplar.id,
      leitorId: leitor.id,
      dataPrevistaDevolucao: dataIso,
    }),
  });

  expect(res.status).toBe(201);
  const body = await res.json();
  const dataPrevista = new Date(body.dataPrevistaDevolucao);
  expect(dataPrevista.toISOString().slice(0, 10)).toBe(dataIso);
});

test("POST /api/v1/loans rejeita data no passado", async () => {
  const { exemplar, leitor } = await criarCenarioEmprestimo();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);

  const res = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({
      exemplarId: exemplar.id,
      leitorId: leitor.id,
      dataPrevistaDevolucao: ontem.toISOString().slice(0, 10),
    }),
  });

  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/Data de devolução fora do permitido/);
});

test("POST /api/v1/loans rejeita data acima de hoje+60", async () => {
  const { exemplar, leitor } = await criarCenarioEmprestimo();
  const muitoLonge = new Date();
  muitoLonge.setDate(muitoLonge.getDate() + 61);

  const res = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({
      exemplarId: exemplar.id,
      leitorId: leitor.id,
      dataPrevistaDevolucao: muitoLonge.toISOString().slice(0, 10),
    }),
  });

  expect(res.status).toBe(400);
});

test("POST /api/v1/loans erro de leitor inativo inclui code=LEITOR_INATIVO", async () => {
  const livro = await criarLivro({ titulo: "T", autores: "A" });
  const exemplar = await criarExemplar(livro.id, girotecaId);
  const leitor = await criarLeitor(girotecaId, {
    nome: "Inativo",
    ativo: false,
  });

  const res = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({ exemplarId: exemplar.id, leitorId: leitor.id }),
  });

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("LEITOR_INATIVO");
});

test("POST /api/v1/loans erro de exemplar indisponível inclui code=EXEMPLAR_INDISPONIVEL", async () => {
  const livro = await criarLivro({ titulo: "T", autores: "A" });
  const exemplar = await criarExemplar(livro.id, girotecaId, {
    status: "emprestado",
  });
  const leitor = await criarLeitor(girotecaId, { nome: "L" });

  const res = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({ exemplarId: exemplar.id, leitorId: leitor.id }),
  });

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("EXEMPLAR_INDISPONIVEL");
});

test("POST /api/v1/loans gestor não pode usar leitor de outra giroteca", async () => {
  const outraGiroteca = await criarGiroteca();
  const livro = await criarLivro({ titulo: "T", autores: "A" });
  const exemplar = await criarExemplar(livro.id, girotecaId);
  const leitorOutra = await criarLeitor(outraGiroteca.id, { nome: "Externo" });

  const res = await fetch("http://localhost:3000/api/v1/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({
      exemplarId: exemplar.id,
      leitorId: leitorOutra.id,
    }),
  });

  expect(res.status).toBe(403);
});
