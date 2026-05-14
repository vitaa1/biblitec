import {
  criarEmprestimo,
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let adminCookie: string;
let gestorCookie: string;
let girotecaId: string;
let gestorId: string;

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
  const gestor = await criarUsuario({
    email: "gestor@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });
  gestorId = gestor.id;

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

test("GET /api/v1/exemplares/buscar sem auth → 401", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/exemplares/buscar?q=T-001",
  );
  expect(res.status).toBe(401);
});

test("GET /api/v1/exemplares/buscar admin → 400", async () => {
  const res = await fetch(
    "http://localhost:3000/api/v1/exemplares/buscar?q=T-001",
    { headers: { Cookie: adminCookie } },
  );
  expect(res.status).toBe(400);
});

test("GET /api/v1/exemplares/buscar tombamento disponível retorna dados completos", async () => {
  const livro = await criarLivro({
    titulo: "Dom Casmurro",
    autores: "Machado",
  });
  await criarExemplar(livro.id, girotecaId, { codigoTombamento: "T-001" });

  const res = await fetch(
    "http://localhost:3000/api/v1/exemplares/buscar?q=T-001",
    { headers: { Cookie: gestorCookie } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.exemplar.codigoTombamento).toBe("T-001");
  expect(body.exemplar.status).toBe("disponivel");
  expect(body.livro.titulo).toBe("Dom Casmurro");
  expect(body.leitorAtual).toBeUndefined();
});

test("GET /api/v1/exemplares/buscar tombamento emprestado retorna leitorAtual", async () => {
  const livro = await criarLivro({
    titulo: "Vidas Secas",
    autores: "Graciliano",
  });
  const exemplar = await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "T-002",
    status: "emprestado",
  });
  const leitor = await criarLeitor(girotecaId, { nome: "Ana", turma: "5A" });
  await criarEmprestimo(exemplar.id, leitor.id, gestorId);

  const res = await fetch(
    "http://localhost:3000/api/v1/exemplares/buscar?q=T-002",
    { headers: { Cookie: gestorCookie } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.exemplar.status).toBe("emprestado");
  expect(body.leitorAtual.nome).toBe("Ana");
  expect(body.leitorAtual.turma).toBe("5A");
  expect(body.leitorAtual.dataEmprestimo).toBeDefined();
});

test("GET /api/v1/exemplares/buscar ISBN retorna primeiro disponível", async () => {
  const livro = await criarLivro({
    titulo: "Capitães da Areia",
    autores: "Jorge Amado",
    isbn: "9788535910664",
  });
  await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "T-A",
    status: "emprestado",
  });
  await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "T-B",
    status: "disponivel",
  });

  const res = await fetch(
    "http://localhost:3000/api/v1/exemplares/buscar?q=9788535910664",
    { headers: { Cookie: gestorCookie } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.exemplar.codigoTombamento).toBe("T-B");
  expect(body.exemplar.status).toBe("disponivel");
});

test("GET /api/v1/exemplares/buscar tombamento de outra giroteca → 404", async () => {
  const outra = await criarGiroteca();
  const livro = await criarLivro({ titulo: "T", autores: "A" });
  await criarExemplar(livro.id, outra.id, { codigoTombamento: "T-X" });

  const res = await fetch(
    "http://localhost:3000/api/v1/exemplares/buscar?q=T-X",
    { headers: { Cookie: gestorCookie } },
  );

  expect(res.status).toBe(404);
});

test("GET /api/v1/exemplares/buscar sem q → 400", async () => {
  const res = await fetch("http://localhost:3000/api/v1/exemplares/buscar", {
    headers: { Cookie: gestorCookie },
  });
  expect(res.status).toBe(400);
});
