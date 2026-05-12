import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

let adminCookie: string;
let gestorCookie: string;
let girotecaId: string;

beforeEach(async () => {
  await limparBanco();

  const giroteca = await criarGiroteca();
  girotecaId = giroteca.id;

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
    girotecaId,
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

test("POST /api/v1/users admin cria gestor e retorna 201", async () => {
  const response = await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      nome: "Novo Gestor",
      email: "novo@test.com",
      senha: "senha123",
      papel: "gestor_giroteca",
      girotecaId,
    }),
  });

  expect(response.status).toBe(201);

  const body = await response.json();
  expect(body.papel).toBe("gestor_giroteca");
  expect(body.girotecaId).toBe(girotecaId);
  expect(body.senhaHash).toBeUndefined();
});

test("POST /api/v1/users sem auth retorna 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome: "Tentativa",
      email: "sem@auth.com",
      senha: "senha123",
      papel: "gestor_giroteca",
      girotecaId,
    }),
  });

  expect(response.status).toBe(401);
});

test("POST /api/v1/users gestor não pode criar usuários (403)", async () => {
  const response = await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: gestorCookie },
    body: JSON.stringify({
      nome: "Tentativa",
      email: "tentativa@test.com",
      senha: "senha123",
      papel: "gestor_giroteca",
      girotecaId,
    }),
  });

  expect(response.status).toBe(403);
});

test("POST /api/v1/users email duplicado retorna 409", async () => {
  await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      nome: "Primeiro",
      email: "dup@test.com",
      senha: "senha123",
      papel: "gestor_giroteca",
      girotecaId,
    }),
  });

  const response = await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      nome: "Segundo",
      email: "dup@test.com",
      senha: "senha123",
      papel: "gestor_giroteca",
      girotecaId,
    }),
  });

  expect(response.status).toBe(409);
});
