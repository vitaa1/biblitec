import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

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
  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("POST /api/v1/students cria leitor e retorna 201", async () => {
  const response = await fetch("http://localhost:3000/api/v1/students", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      nome: "Ana Lúcia",
      matricula: "MAT-001",
      girotecaId,
    }),
  });

  expect(response.status).toBe(201);

  const body = await response.json();
  expect(body.nome).toBe("Ana Lúcia");
  expect(body.matricula).toBe("MAT-001");
  expect(body.girotecaId).toBe(girotecaId);
  expect(body.id).toBeDefined();
});

test("POST /api/v1/students sem girotecaId retorna 400", async () => {
  const response = await fetch("http://localhost:3000/api/v1/students", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ nome: "Ana Lúcia", matricula: "MAT-001" }),
  });

  expect(response.status).toBe(400);
});

test("POST /api/v1/students sem auth retorna 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome: "Ana Lúcia",
      matricula: "MAT-001",
      girotecaId,
    }),
  });

  expect(response.status).toBe(401);
});
