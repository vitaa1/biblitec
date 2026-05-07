import database from "infra/database";

beforeAll(cleanDatabase);
async function cleanDatabase() {
  await database.query({ text: "TRUNCATE TABLE users CASCADE;" });
}

test("POST to api/v1/auth/login with valid credentials should return 200", async () => {
  await fetch("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email: "test@test.com",
      password: "senha123",
    }),
  });

  const response = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@test.com", password: "senha123" }),
  });

  expect(response.status).toBe(200);

  const responseBody = await response.json();
  expect(responseBody.email).toEqual("test@test.com");
  expect(responseBody.password).toBeUndefined();
});

test("POST to api/v1/auth/login with invalid credentials should return 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@test.com", password: "senhaerrada" }),
  });

  expect(response.status).toBe(401);

  const responseBody = await response.json();
  expect(responseBody.error).toEqual("Credenciais inválidas.");
});
