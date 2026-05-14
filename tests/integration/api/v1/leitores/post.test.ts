import {
  criarGiroteca,
  criarLeitor,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let adminCookie: string;
let gestorCookie: string;
let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "TST-A", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "TST-B", nome: "Giroteca B" });

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
    girotecaId: girotecaA.id,
  });

  const loginAdmin = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  adminCookie = loginAdmin.headers.get("set-cookie")!.split(";")[0].trim();

  const loginGestor = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  gestorCookie = loginGestor.headers.get("set-cookie")!.split(";")[0].trim();
});

test("POST /api/v1/leitores cria leitor e retorna 201", async () => {
  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      nome: "Ana Lúcia",
      matricula: "MAT-001",
      girotecaId: girotecaA.id,
    }),
  });

  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.nome).toBe("Ana Lúcia");
  expect(body.girotecaId).toBe(girotecaA.id);
  expect(body.id).toBeDefined();
});

test("POST /api/v1/leitores sem girotecaId retorna 400", async () => {
  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ nome: "Ana Lúcia" }),
  });
  expect(res.status).toBe(400);
});

test("POST /api/v1/leitores matrícula duplicada retorna 409 com code", async () => {
  await criarLeitor(girotecaA.id, { matricula: "MAT-DUP" });

  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({
      nome: "Outro Leitor",
      matricula: "MAT-DUP",
      girotecaId: girotecaA.id,
    }),
  });

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("MATRICULA_DUPLICADA");
});

test("POST /api/v1/leitores gestor não pode criar em outra giroteca", async () => {
  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({
      nome: "Invasor",
      girotecaId: girotecaB.id,
    }),
  });
  expect(res.status).toBe(403);
});

test("POST /api/v1/leitores sem auth retorna 401", async () => {
  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: "Ana", girotecaId: girotecaA.id }),
  });
  expect(res.status).toBe(401);
});
