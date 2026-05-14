import {
  criarGiroteca,
  criarLeitor,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let adminCookie: string;
let gestorCookie: string;
let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "TST-A", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "TST-B", nome: "Giroteca B" });

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
    girotecaId: girotecaA.id,
  });

  const loginAdmin = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  adminCookie = loginAdmin.headers.get("set-cookie")!.split(";")[0].trim();

  const loginGestor = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor@test.com", senha: "senha123" }),
  });
  gestorCookie = loginGestor.headers.get("set-cookie")!.split(";")[0].trim();
});

test("GET /api/v1/leitores retorna lista paginada", async () => {
  await criarLeitor(girotecaA.id, { nome: "Ana Lúcia", matricula: "MAT-001" });

  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    headers: { Cookie: adminCookie },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.leitores)).toBe(true);
  expect(typeof body.total).toBe("number");
  expect(
    body.leitores.some((l: { nome: string }) => l.nome === "Ana Lúcia"),
  ).toBe(true);
});

test("GET /api/v1/leitores gestor só vê leitores da própria giroteca", async () => {
  await criarLeitor(girotecaA.id, { nome: "Leitor A", matricula: "A001" });
  await criarLeitor(girotecaB.id, { nome: "Leitor B", matricula: "B001" });

  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    headers: { Cookie: gestorCookie },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(
    body.leitores.every(
      (l: { girotecaId: string }) => l.girotecaId === girotecaA.id,
    ),
  ).toBe(true);
  expect(
    body.leitores.some((l: { nome: string }) => l.nome === "Leitor B"),
  ).toBe(false);
});

test("GET /api/v1/leitores admin filtra por girotecaId", async () => {
  await criarLeitor(girotecaA.id, { nome: "Leitor A", matricula: "A001" });
  await criarLeitor(girotecaB.id, { nome: "Leitor B", matricula: "B001" });

  const res = await fetch(
    `http://localhost:3000/api/v1/leitores?girotecaId=${girotecaA.id}`,
    { headers: { Cookie: adminCookie } },
  );

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.leitores).toHaveLength(1);
  expect(body.leitores[0].nome).toBe("Leitor A");
});

test("GET /api/v1/leitores filtra por busca parcial com acentuação", async () => {
  await criarLeitor(girotecaA.id, { nome: "João Silva", matricula: "A001" });
  await criarLeitor(girotecaA.id, { nome: "Maria Souza", matricula: "A002" });

  const res = await fetch("http://localhost:3000/api/v1/leitores?q=jo%C3%A3", {
    headers: { Cookie: gestorCookie },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.leitores).toHaveLength(1);
  expect(body.leitores[0].nome).toBe("João Silva");
});

test("GET /api/v1/leitores retorna emprestimosEmAberto", async () => {
  await criarLeitor(girotecaA.id);

  const res = await fetch("http://localhost:3000/api/v1/leitores", {
    headers: { Cookie: gestorCookie },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(typeof body.leitores[0].emprestimosEmAberto).toBe("number");
});

test("GET /api/v1/leitores sem auth retorna 401", async () => {
  const res = await fetch("http://localhost:3000/api/v1/leitores");
  expect(res.status).toBe(401);
});
