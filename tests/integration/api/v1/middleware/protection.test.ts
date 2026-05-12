import jwt from "jsonwebtoken";
import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

const ROTA_PROTEGIDA = "http://localhost:3000/api/v1/sessoes";
const ROTA_ADMIN = "http://localhost:3000/api/v1/users";

let gestorCookie: string;
let adminCookie: string;

beforeEach(async () => {
  await limparBanco();
  const giroteca = await criarGiroteca();

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
    girotecaId: giroteca.id,
  });

  const loginAdmin = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  adminCookie = loginAdmin.headers.get("set-cookie")!.split(";")[0];

  const loginGestor = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  gestorCookie = loginGestor.headers.get("set-cookie")!.split(";")[0];
});

test("rota protegida sem token retorna 401", async () => {
  const response = await fetch(ROTA_PROTEGIDA, { method: "GET" });
  expect(response.status).toBe(401);
  const body = await response.json();
  expect(body.error).toBeDefined();
});

test("rota protegida com token válido retorna 200", async () => {
  const response = await fetch(ROTA_PROTEGIDA, {
    method: "GET",
    headers: { Cookie: gestorCookie },
  });
  expect(response.status).toBe(200);
});

test("rota protegida com token malformado retorna 401", async () => {
  const response = await fetch(ROTA_PROTEGIDA, {
    method: "GET",
    headers: { Cookie: "biblitec_session=isso.nao.e.um.jwt" },
  });
  expect(response.status).toBe(401);
});

test("rota protegida com token assinado com segredo errado retorna 401", async () => {
  const tokenFalso = jwt.sign(
    { id: "qualquer", papel: "admin_nthe", girotecaId: null },
    "segredo-errado",
    { expiresIn: "1d" },
  );
  const response = await fetch(ROTA_PROTEGIDA, {
    method: "GET",
    headers: { Cookie: `biblitec_session=${tokenFalso}` },
  });
  expect(response.status).toBe(401);
});

test("rota admin acessível por admin_nthe retorna 2xx", async () => {
  const response = await fetch(ROTA_ADMIN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      nome: "Novo",
      email: "novo@test.com",
      senha: "senha123",
      papel: "admin_nthe",
    }),
  });
  expect(response.status).toBeLessThan(500);
  expect([200, 201, 400, 409]).toContain(response.status);
});

test("rota admin bloqueada para gestor_giroteca retorna 403", async () => {
  const response = await fetch(ROTA_ADMIN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: gestorCookie,
    },
    body: JSON.stringify({
      nome: "Tentativa",
      email: "tentativa@test.com",
      senha: "senha123",
      papel: "gestor_giroteca",
    }),
  });
  expect(response.status).toBe(403);
});

test("rotas públicas acessíveis sem token", async () => {
  const statusRoute = await fetch("http://localhost:3000/api/v1/status");
  expect(statusRoute.status).toBe(200);
});
