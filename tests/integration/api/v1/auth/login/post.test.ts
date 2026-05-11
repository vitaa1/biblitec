import { criarUsuario, limparBanco } from "tests/factories";

beforeEach(async () => {
  await limparBanco();
});

test("POST /api/v1/auth/login com credenciais válidas retorna 200", async () => {
  const usuario = await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });

  const response = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(body.email).toBe("admin@test.com");
  expect(body.papel).toBe("admin_nthe");
  expect(body.senhaHash).toBeUndefined();

  const cookie = response.headers.get("set-cookie");
  expect(cookie).toMatch(/token=/);
  expect(cookie).toMatch(/HttpOnly/);
});

test("POST /api/v1/auth/login com senha errada retorna 401", async () => {
  await criarUsuario({ email: "admin@test.com", senha: "correta" });

  const response = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "errada" }),
  });

  expect(response.status).toBe(401);

  const body = await response.json();
  expect(body.error).toBe("Credenciais inválidas.");
});

test("POST /api/v1/auth/login com email inexistente retorna 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "naoexiste@test.com", senha: "qualquer" }),
  });

  expect(response.status).toBe(401);
});

test("POST /api/v1/auth/login sem campos retorna 400", async () => {
  const response = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  expect(response.status).toBe(400);
});
