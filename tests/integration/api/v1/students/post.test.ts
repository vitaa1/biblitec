import database from "infra/database";

beforeEach(cleanDatabase);
async function cleanDatabase() {
  await database.query({ text: "TRUNCATE TABLE leitores, usuarios CASCADE;" });
}

async function createUserAndLogin(): Promise<string> {
  await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome: "Test User",
      email: "test@gmail.com",
      senha: "senha123",
    }),
  });

  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@gmail.com", password: "senha123" }),
  });

  const rawCookie = loginRes.headers.get("set-cookie");
  if (!rawCookie) throw new Error("Login falhou: cookie não retornado");
  return rawCookie.split(";")[0].trim();
}

test("POST /api/v1/students should create a student and return 201", async () => {
  const cookie = await createUserAndLogin();

  const response = await fetch("http://localhost:3000/api/v1/students", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ nome: "Aluno Teste", matricula: "MAT-001" }),
  });

  expect(response.status).toBe(201);

  const body = await response.json();
  expect(body.nome).toBe("Aluno Teste");
  expect(body.matricula).toBe("MAT-001");
  expect(body.id).toBeDefined();
});
