import {
  criarEmprestimo,
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let cookie: string;
let girotecaId: string;
let gestorId: string;

beforeEach(async () => {
  await limparBanco();

  const giroteca = await criarGiroteca();
  girotecaId = giroteca.id;

  const gestor = await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });
  gestorId = gestor.id;

  const loginRes = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  cookie = loginRes.headers.get("set-cookie")!.split(";")[0].trim();
});

test("GET /api/v1/emprestimos/buscar-devolucao retorna 200 para tombamento emprestado", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "BUSCA-DEV-001",
    status: "emprestado",
  });
  const leitor = await criarLeitor(girotecaId);
  await criarEmprestimo(exemplar.id, leitor.id, gestorId);

  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao?q=BUSCA-DEV-001",
    { headers: { Cookie: cookie } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.exemplar.codigoTombamento).toBe("BUSCA-DEV-001");
  expect(body.leitor.nome).toBe("Leitor de Teste");
  expect(body.emprestimoId).toBeDefined();
  expect(body.livro.titulo).toBe("Livro de Teste");
});

test("GET /api/v1/emprestimos/buscar-devolucao retorna 404 para tombamento disponível", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "BUSCA-DEV-002",
    status: "disponivel",
  });

  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao?q=BUSCA-DEV-002",
    { headers: { Cookie: cookie } },
  );

  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body.code).toBe("SEM_EMPRESTIMO_ABERTO");
});

test("GET /api/v1/emprestimos/buscar-devolucao retorna 404 para tombamento de outra giroteca", async () => {
  const outraGiroteca = await criarGiroteca({ codigo: `OUTRA-${Date.now()}` });
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, outraGiroteca.id, {
    codigoTombamento: "BUSCA-DEV-003",
    status: "emprestado",
  });
  const outraGestora = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: outraGiroteca.id,
  });
  const leitor = await criarLeitor(outraGiroteca.id);
  await criarEmprestimo(exemplar.id, leitor.id, outraGestora.id);

  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao?q=BUSCA-DEV-003",
    { headers: { Cookie: cookie } },
  );

  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body.code).toBeUndefined();
});

test("GET /api/v1/emprestimos/buscar-devolucao retorna 404 para exemplar baixado", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "BUSCA-DEV-004",
    status: "baixado",
  });

  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao?q=BUSCA-DEV-004",
    { headers: { Cookie: cookie } },
  );

  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body.code).toBe("EXEMPLAR_BAIXADO");
});

test("GET /api/v1/emprestimos/buscar-devolucao retorna 409 para ISBN com >1 emprestados", async () => {
  const livro = await criarLivro({ isbn: "9783333333333" });
  const ex1 = await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "BUSCA-ISBN-1A",
    status: "emprestado",
  });
  const ex2 = await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "BUSCA-ISBN-1B",
    status: "emprestado",
  });
  const leitor1 = await criarLeitor(girotecaId, { matricula: "MAT-ISBN-1A" });
  const leitor2 = await criarLeitor(girotecaId, { matricula: "MAT-ISBN-1B" });
  await criarEmprestimo(ex1.id, leitor1.id, gestorId);
  await criarEmprestimo(ex2.id, leitor2.id, gestorId);

  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao?q=9783333333333",
    { headers: { Cookie: cookie } },
  );

  expect(res.status).toBe(409);
  const body = await res.json();
  expect(body.code).toBe("MULTIPLOS_EMPRESTADOS");
});

test("GET /api/v1/emprestimos/buscar-devolucao retorna 400 para admin", async () => {
  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  const loginAdmin = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  const cookieAdmin = loginAdmin.headers
    .get("set-cookie")!
    .split(";")[0]
    .trim();

  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao?q=QUALQUER",
    { headers: { Cookie: cookieAdmin } },
  );

  expect(res.status).toBe(400);
});

test("GET /api/v1/emprestimos/buscar-devolucao sem auth retorna 401", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao?q=QUALQUER",
  );
  expect(res.status).toBe(401);
});

test("GET /api/v1/emprestimos/buscar-devolucao sem parâmetro q retorna 400", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/emprestimos/buscar-devolucao",
    { headers: { Cookie: cookie } },
  );
  expect(res.status).toBe(400);
});
