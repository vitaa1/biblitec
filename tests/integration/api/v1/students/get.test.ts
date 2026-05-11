import {
  criarGiroteca,
  criarLeitor,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
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
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("GET /api/v1/students lista leitores", async () => {
  await criarLeitor(girotecaId, { nome: "Ana Lúcia", matricula: "MAT-001" });

  const response = await fetch("http://localhost:3000/api/v1/students", {
    headers: { Cookie: cookie },
  });

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.some((l: { nome: string }) => l.nome === "Ana Lúcia")).toBe(true);
});

test("GET /api/v1/students sem auth retorna 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/students");

  expect(response.status).toBe(401);
});
