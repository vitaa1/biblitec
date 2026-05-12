import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

const URL = "http://localhost:3000/api/v1/sessoes";

beforeEach(async () => {
  await limparBanco();
  const giroteca = await criarGiroteca();
  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });
});

test("POST /api/v1/sessoes retorna 200 e seta cookie com credenciais válidas", async () => {
  const response = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(body.email).toBe("gestor@test.com");
  expect(body.senhaHash).toBeUndefined();

  const cookie = response.headers.get("set-cookie");
  expect(cookie).toMatch(/biblitec_session=/);
  expect(cookie).toMatch(/HttpOnly/i);
});

test("POST /api/v1/sessoes retorna 401 com senha errada", async () => {
  const response = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "errada" }),
  });

  expect(response.status).toBe(401);
  const body = await response.json();
  expect(body.error).toBeDefined();
});

test("POST /api/v1/sessoes retorna 400 com JSON malformado", async () => {
  const response = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "isso não é json{{{",
  });

  expect(response.status).toBe(400);
});

test("POST /api/v1/sessoes retorna 400 sem email", async () => {
  const response = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senha: "senha123" }),
  });

  expect(response.status).toBe(400);
});

test("POST /api/v1/sessoes retorna 429 após muitas tentativas consecutivas", async () => {
  const email = "alvo-rate-limit@test.com";
  const statuses: number[] = [];

  for (let i = 0; i < 6; i++) {
    const r = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha: "errada" }),
    });
    statuses.push(r.status);
  }

  expect(statuses).toContain(429);
});
