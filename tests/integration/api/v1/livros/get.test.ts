import {
  criarExemplar,
  criarGiroteca,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let adminCookie: string;
let gestorCookie: string;
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
  await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });

  const loginAdmin = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  adminCookie = loginAdmin.headers.get("set-cookie")!.split(";")[0];

  const loginGestor = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  gestorCookie = loginGestor.headers.get("set-cookie")!.split(";")[0];
});

test("GET /api/v1/livros sem auth retorna 401", async () => {
  const res = await fetch("http://localhost:3000/api/v1/livros");
  expect(res.status).toBe(401);
});

test("GET /api/v1/livros retorna lista paginada com total e totalPages", async () => {
  await criarLivro({ titulo: "Dom Casmurro", autores: "Machado de Assis" });
  await criarLivro({ titulo: "Vidas Secas", autores: "Graciliano Ramos" });

  const res = await fetch("http://localhost:3000/api/v1/livros", {
    headers: { Cookie: adminCookie },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.livros).toHaveLength(2);
  expect(body.total).toBe(2);
  expect(body.page).toBe(1);
  expect(body.totalPages).toBeGreaterThanOrEqual(1);
});

test("GET /api/v1/livros?q= filtra por título", async () => {
  await criarLivro({ titulo: "Dom Casmurro", autores: "Machado de Assis" });
  await criarLivro({ titulo: "Vidas Secas", autores: "Graciliano Ramos" });

  const res = await fetch("http://localhost:3000/api/v1/livros?q=Dom", {
    headers: { Cookie: adminCookie },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.livros).toHaveLength(1);
  expect(body.livros[0].titulo).toBe("Dom Casmurro");
});

test("GET /api/v1/livros?isbn= filtra por ISBN (com hifens)", async () => {
  await criarLivro({ titulo: "Dom Casmurro", autores: "Machado", isbn: "9788535910663" });
  await criarLivro({ titulo: "Vidas Secas", autores: "Graciliano" });

  const res = await fetch(
    "http://localhost:3000/api/v1/livros?isbn=978-85-359-1066-3",
    { headers: { Cookie: adminCookie } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.livros).toHaveLength(1);
  expect(body.livros[0].titulo).toBe("Dom Casmurro");
});

test("GET /api/v1/livros gestor vê qtdDisponiveis apenas da própria giroteca", async () => {
  const outraGiroteca = await criarGiroteca();
  const livro = await criarLivro({ titulo: "Compartilhado", autores: "Autor" });
  await criarExemplar(livro.id, girotecaId);
  await criarExemplar(livro.id, outraGiroteca.id);

  const res = await fetch("http://localhost:3000/api/v1/livros", {
    headers: { Cookie: gestorCookie },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.livros[0].qtdDisponiveis).toBe(1);
});

test("GET /api/v1/livros gestor busca ISBN com exemplares só em outra giroteca — livro aparece com qtdDisponiveis 0", async () => {
  const outraGiroteca = await criarGiroteca();
  const livro = await criarLivro({
    titulo: "Só na outra",
    autores: "Autor",
    isbn: "9780000000001",
  });
  // exemplar apenas na outra giroteca, não na do gestor
  await criarExemplar(livro.id, outraGiroteca.id);

  const res = await fetch(
    "http://localhost:3000/api/v1/livros?isbn=9780000000001",
    { headers: { Cookie: gestorCookie } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.livros).toHaveLength(1);
  expect(body.livros[0].qtdDisponiveis).toBe(0);
});

test("GET /api/v1/livros busca sem resultado retorna array vazio, não erro", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/livros?q=naoexistejamais",
    { headers: { Cookie: adminCookie } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.livros).toHaveLength(0);
  expect(body.total).toBe(0);
});
