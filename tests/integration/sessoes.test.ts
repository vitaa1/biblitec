import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

const BASE = "http://localhost:3000/api/v1";

beforeEach(async () => {
  await limparBanco();
});

test("fluxo completo: login → requisição autenticada → logout", async () => {
  const giroteca = await criarGiroteca();
  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });

  // 1. login
  const login = await fetch(`${BASE}/sessoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  expect(login.status).toBe(200);
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  expect(cookie).toMatch(/^token=/);

  // 2. requisição autenticada
  const sessao = await fetch(`${BASE}/sessoes`, {
    method: "GET",
    headers: { Cookie: cookie },
  });
  expect(sessao.status).toBe(200);
  const dados = await sessao.json();
  expect(dados.email).toBe("gestor@test.com");

  // 3. logout
  const logout = await fetch(`${BASE}/sessoes`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  expect(logout.status).toBe(200);
  const cookieLimpo = logout.headers.get("set-cookie") ?? "";
  expect(cookieLimpo).toMatch(/Max-Age=0/i);

  // 4. cookie limpo não acessa mais rotas protegidas
  const aposLogout = await fetch(`${BASE}/sessoes`, { method: "GET" });
  expect(aposLogout.status).toBe(401);
});

test("login com credenciais erradas não concede acesso", async () => {
  await criarUsuario({ email: "gestor@test.com", senha: "correta" });

  const login = await fetch(`${BASE}/sessoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "errada" }),
  });
  expect(login.status).toBe(401);

  const cookieHeader = login.headers.get("set-cookie") ?? "";
  expect(cookieHeader).not.toMatch(/^token=[^;]+/);
});

test("token adulterado não acessa rotas protegidas", async () => {
  const response = await fetch(`${BASE}/sessoes`, {
    method: "GET",
    headers: { Cookie: "token=eyJhbGciOiJIUzI1NiJ9.falso.assinatura" },
  });
  expect(response.status).toBe(401);
});
