import { criarUsuario, limparBanco } from "tests/factories";

let cookie: string;

beforeEach(async () => {
  await limparBanco();
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

test("POST /api/v1/books cria livro e retorna 201", async () => {
  const response = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      titulo: "Clean Code",
      autores: "Robert Martin",
      isbn: "9780132350884",
    }),
  });

  expect(response.status).toBe(201);

  const body = await response.json();
  expect(body.titulo).toBe("Clean Code");
  expect(body.autores).toBe("Robert Martin");
  expect(body.id).toBeDefined();
  expect(body.quantidade).toBeUndefined();
});

test("POST /api/v1/books sem autores retorna 400", async () => {
  const response = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ titulo: "Só o título" }),
  });

  expect(response.status).toBe(400);
});

test("POST /api/v1/books ISBN duplicado retorna 409", async () => {
  const data = {
    titulo: "Clean Code",
    autores: "Robert Martin",
    isbn: "9780132350884",
  };

  await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(data),
  });

  const response = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(data),
  });

  expect(response.status).toBe(409);
});

test("POST /api/v1/books sem auth retorna 401", async () => {
  const response = await fetch("http://localhost:3000/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titulo: "Teste", autores: "Autor" }),
  });

  expect(response.status).toBe(401);
});
