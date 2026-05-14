import {
  criarGiroteca,
  criarLeitor,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let gestorCookie: string;
let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "TST-A", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "TST-B", nome: "Giroteca B" });

  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  const login = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  gestorCookie = login.headers.get("set-cookie")!.split(";")[0].trim();
});

test("PUT /api/v1/leitores/[id] atualiza nome do leitor", async () => {
  const leitor = await criarLeitor(girotecaA.id, { nome: "Nome Antigo" });

  const res = await fetch(
    `http://localhost:3000/api/v1/leitores/${leitor.id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: gestorCookie },
      body: JSON.stringify({ nome: "Nome Novo" }),
    },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.nome).toBe("Nome Novo");
});

test("PUT /api/v1/leitores/[id] matrícula duplicada retorna 409 com code", async () => {
  await criarLeitor(girotecaA.id, { matricula: "MAT-EXISTE" });
  const leitor = await criarLeitor(girotecaA.id, { matricula: "MAT-OUTRO" });

  const res = await fetch(
    `http://localhost:3000/api/v1/leitores/${leitor.id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: gestorCookie },
      body: JSON.stringify({ matricula: "MAT-EXISTE" }),
    },
  );

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("MATRICULA_DUPLICADA");
});

test("PUT /api/v1/leitores/[id] retorna 404 para leitor inexistente", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/leitores/00000000-0000-0000-0000-000000000000",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: gestorCookie },
      body: JSON.stringify({ nome: "Qualquer" }),
    },
  );
  expect(res.status).toBe(404);
});

test("PUT /api/v1/leitores/[id] gestor não pode editar leitor de outra giroteca", async () => {
  const leitor = await criarLeitor(girotecaB.id);

  const res = await fetch(
    `http://localhost:3000/api/v1/leitores/${leitor.id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: gestorCookie },
      body: JSON.stringify({ nome: "Hackeado" }),
    },
  );
  expect(res.status).toBe(403);
});

test("PUT /api/v1/leitores/[id] ID inválido retorna 400", async () => {
  const res = await fetch("http://localhost:3000/api/v1/leitores/nao-e-uuid", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({ nome: "Qualquer" }),
  });
  expect(res.status).toBe(400);
});
