import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

const URL = "http://localhost:3000/api/v1/sessoes";

beforeEach(async () => {
  await limparBanco();
});

test("DELETE /api/v1/sessoes limpa o cookie e retorna 200", async () => {
  const giroteca = await criarGiroteca();
  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });

  const login = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  const cookie = login.headers.get("set-cookie")!.split(";")[0];

  const response = await fetch(URL, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });

  expect(response.status).toBe(200);

  const setCookie = response.headers.get("set-cookie") ?? "";
  expect(setCookie).toMatch(/biblitec_session=;|biblitec_session=(?:;|$)/i);
  expect(setCookie).toMatch(/Max-Age=0/i);
});

test("DELETE /api/v1/sessoes sem cookie retorna 401", async () => {
  const response = await fetch(URL, { method: "DELETE" });
  expect(response.status).toBe(401);
});
