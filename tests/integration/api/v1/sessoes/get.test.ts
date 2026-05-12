import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

const URL = "http://localhost:3000/api/v1/sessoes";
const LOGIN_URL = "http://localhost:3000/api/v1/sessoes";

beforeEach(async () => {
  await limparBanco();
});

test("GET /api/v1/sessoes retorna dados do usuário autenticado", async () => {
  const giroteca = await criarGiroteca();
  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });

  const login = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  const cookie = login.headers.get("set-cookie")!.split(";")[0];

  const response = await fetch(URL, {
    method: "GET",
    headers: { Cookie: cookie },
  });

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(body.email).toBe("gestor@test.com");
  expect(body.papel).toBe("gestor_giroteca");
  expect(body.senhaHash).toBeUndefined();
});

test("GET /api/v1/sessoes sem autenticação retorna 401", async () => {
  const response = await fetch(URL, { method: "GET" });
  expect(response.status).toBe(401);
});
