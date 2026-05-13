import { criarUsuario, limparBanco } from "tests/factories";

let adminCookie: string;

beforeEach(async () => {
  await limparBanco();
  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });

  const login = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  adminCookie = login.headers.get("set-cookie")!.split(";")[0];
});

test("GET /api/v1/isbn sem autenticação retorna 401", async () => {
  const res = await fetch("http://localhost:3000/api/v1/isbn/9788535910663");
  expect(res.status).toBe(401);
});

test("GET /api/v1/isbn ISBN com menos de 10 dígitos retorna 400", async () => {
  const res = await fetch("http://localhost:3000/api/v1/isbn/123", {
    headers: { Cookie: adminCookie },
  });
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/ISBN inválido/);
});

test("GET /api/v1/isbn ISBN com 11 dígitos retorna 400", async () => {
  const res = await fetch("http://localhost:3000/api/v1/isbn/12345678901", {
    headers: { Cookie: adminCookie },
  });
  expect(res.status).toBe(400);
});

test("GET /api/v1/isbn ISBN com letras retorna 400", async () => {
  const res = await fetch("http://localhost:3000/api/v1/isbn/978ABC123456", {
    headers: { Cookie: adminCookie },
  });
  expect(res.status).toBe(400);
});

test("GET /api/v1/isbn ISBN com hifens é normalizado e aceito", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/isbn/978-85-359-1066-3",
    { headers: { Cookie: adminCookie } },
  );
  // Formato válido — pode retornar 200 ou 404 dependendo das APIs externas
  expect([200, 404]).toContain(res.status);
});
