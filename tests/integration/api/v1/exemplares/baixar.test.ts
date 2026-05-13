import {
  criarEmprestimo,
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let girotecaAId: string;
let gestorId: string;

beforeEach(async () => {
  await limparBanco();
  const girotecaA = await criarGiroteca({ codigo: "GA04", nome: "Giroteca A" });
  girotecaAId = girotecaA.id;
  const gestor = await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  gestorId = gestor.id;
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("PATCH /api/v1/exemplares/[id]/baixar baixa exemplar disponível", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaAId, {
    codigoTombamento: "001",
    status: "disponivel",
  });

  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/${exemplar.id}/baixar`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ motivo: "Perdido" }),
    },
  );

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.status).toBe("baixado");
  expect(body.observacoes).toBe("Perdido");
});

test("PATCH retorna 409 com nome do leitor quando exemplar está emprestado", async () => {
  const livro = await criarLivro();
  const leitor = await criarLeitor(girotecaAId, { nome: "Beatriz Sousa" });
  const exemplar = await criarExemplar(livro.id, girotecaAId, {
    codigoTombamento: "002",
    status: "emprestado",
  });
  await criarEmprestimo(exemplar.id, leitor.id, gestorId);

  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/${exemplar.id}/baixar`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ motivo: "Perdido" }),
    },
  );

  expect(response.status).toBe(409);
  const body = await response.json();
  expect(body.error).toContain("Beatriz Sousa");
});

test("PATCH sem motivo retorna 400", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaAId, {
    codigoTombamento: "003",
  });

  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/${exemplar.id}/baixar`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({}),
    },
  );

  expect(response.status).toBe(400);
});

test("PATCH gestor não pode baixar exemplar de outra giroteca — retorna 403", async () => {
  const girotecaB = await criarGiroteca({ codigo: "GB04", nome: "Giroteca B" });
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaB.id, {
    codigoTombamento: "B-001",
  });

  const response = await fetch(
    `http://localhost:3000/api/v1/exemplares/${exemplar.id}/baixar`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ motivo: "Descartado" }),
    },
  );

  expect(response.status).toBe(403);
});

test("PATCH exemplar inexistente retorna 404", async () => {
  const response = await fetch(
    "http://localhost:3000/api/v1/exemplares/00000000-0000-0000-0000-000000000000/baixar",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ motivo: "Outro" }),
    },
  );

  expect(response.status).toBe(404);
});

test("PATCH sem auth retorna 401", async () => {
  const response = await fetch(
    "http://localhost:3000/api/v1/exemplares/00000000-0000-0000-0000-000000000000/baixar",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: "Outro" }),
    },
  );

  expect(response.status).toBe(401);
});
