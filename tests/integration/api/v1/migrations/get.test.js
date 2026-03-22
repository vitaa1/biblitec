import database from "infra/database.js";

beforeAll(cleanDatabase);
async function cleanDatabase() {
  await database.query("drop schema public cascade; create schema public");
}

afterAll(async () => {
  await database.pool.end();
});
test("GET To api/v1/migrations should return 200", async () => {
  const response = await fetch("http:localhost:3000/api/v1/migrations");
  expect(response.status).toBe(200);

  const responseBody = await response.json();
  expect(Array.isArray(responseBody)).toBe(true);
});
