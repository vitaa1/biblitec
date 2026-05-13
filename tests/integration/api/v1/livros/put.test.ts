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

async function criarLivroViaApi(c: string) {
  const res = await fetch("http://localhost:3000/api/v1/livros", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: c },
    body: JSON.stringify({
      titulo: "Clean Code",
      autores: "Robert Martin",
      isbn: "9780132350884",
      categoria: "Outros",
    }),
  });
  if (!res.ok) throw new Error(`Falha ao criar livro: ${res.status}`);
  return res.json();
}

test("PUT /api/v1/livros/:id atualiza campos e retorna 200", async () => {
  const livro = await criarLivroViaApi(cookie);

  const response = await fetch(
    `http://localhost:3000/api/v1/livros/${livro.id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ editora: "Prentice Hall", anoPublicacao: 2008 }),
    },
  );

  expect(response.status).toBe(200);

  const body = await response.json();
  expect(body.editora).toBe("Prentice Hall");
  expect(body.anoPublicacao).toBe(2008);
  expect(body.titulo).toBe("Clean Code");
});

test("PUT /api/v1/livros/:id livro inexistente retorna 404", async () => {
  const response = await fetch(
    "http://localhost:3000/api/v1/livros/00000000-0000-0000-0000-000000000000",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ editora: "Qualquer" }),
    },
  );

  expect(response.status).toBe(404);
});
