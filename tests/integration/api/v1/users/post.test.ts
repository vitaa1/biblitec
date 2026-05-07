import database from "infra/database";

beforeEach(cleanDatabase);
async function cleanDatabase() {
  await database.query({ text: "TRUNCATE TABLE users CASCADE;" });
}

async function login(email: string, password: string): Promise<string> {
  const response = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("Login falhou: cookie não retornado");
  return cookie;
}

test("POST /api/v1/users should allow bootstrap of the first admin", async () => {
  const response = await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Admin Inicial",
      email: "admin@test.com",
      password: "senha123",
    }),
  });

  expect(response.status).toBe(201);

  const body = await response.json();
  expect(body.role).toBe("ADMIN");
});

test("POST /api/v1/users should block public creation after bootstrap", async () => {
  await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Admin Inicial",
      email: "admin@test.com",
      password: "senha123",
    }),
  });

  const response = await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Novo Usuario",
      email: "novo@test.com",
      password: "senha123",
    }),
  });

  expect(response.status).toBe(401);

  const body = await response.json();
  expect(body.error).toBe("Autenticação obrigatória para criar novos usuários.");
});

test("POST /api/v1/users should allow authenticated admin to create another user", async () => {
  await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Admin Inicial",
      email: "admin@test.com",
      password: "senha123",
    }),
  });

  const cookie = await login("admin@test.com", "senha123");

  const response = await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      name: "Novo Admin",
      email: "novo@test.com",
      password: "senha123",
    }),
  });

  expect(response.status).toBe(201);

  const body = await response.json();
  expect(body.name).toBe("Novo Admin");
});
