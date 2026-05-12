import jwt from "jsonwebtoken";
import {
  criarGiroteca,
  criarLeitor,
  criarUsuario,
  limparBanco,
} from "tests/factories";

const BASE = "http://localhost:3000";

let adminCookie: string;
let gestorACookie: string;
let girotecaAId: string;
let girotecaBId: string;

beforeEach(async () => {
  await limparBanco();

  const girotecaA = await criarGiroteca({ codigo: "MA01", nome: "Giroteca A" });
  const girotecaB = await criarGiroteca({ codigo: "MB01", nome: "Giroteca B" });
  girotecaAId = girotecaA.id;
  girotecaBId = girotecaB.id;

  await criarUsuario({
    email: "admin@test.com",
    senha: "senha123",
    papel: "admin_nthe",
    girotecaId: null,
  });
  await criarUsuario({
    email: "gestor.a@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });

  const loginAdmin = await fetch(`${BASE}/api/v1/sessoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", senha: "senha123" }),
  });
  adminCookie = loginAdmin.headers.get("set-cookie")!.split(";")[0];

  const loginGestorA = await fetch(`${BASE}/api/v1/sessoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "gestor.a@test.com", senha: "senha123" }),
  });
  gestorACookie = loginGestorA.headers.get("set-cookie")!.split(";")[0];
});

// ─── Cenário 1 — Gestor vendo próprio dado ────────────────────────────────────

test("C1: gestor acessa leitores da própria giroteca → 200", async () => {
  await criarLeitor(girotecaAId);
  const r = await fetch(`${BASE}/api/v1/students`, {
    headers: { Cookie: gestorACookie },
  });
  expect(r.status).toBe(200);
  const lista = await r.json();
  expect(Array.isArray(lista)).toBe(true);
});

test("C1: gestor acessa emprestimos da própria giroteca → 200", async () => {
  const r = await fetch(`${BASE}/api/v1/loans`, {
    headers: { Cookie: gestorACookie },
  });
  expect(r.status).toBe(200);
  expect(Array.isArray(await r.json())).toBe(true);
});

// ─── Cenário 2 — Gestor tentando dado alheio ─────────────────────────────────
// ⚠ Testa models/, não o middleware. O middleware passa a requisição; o model
//   filtra por giroteca_id e gestor A nunca vê dados de B.

test("C2: gestor A não vê leitores da giroteca B (filtrado em models)", async () => {
  const leitorA = await criarLeitor(girotecaAId);
  const leitorB = await criarLeitor(girotecaBId);
  const r = await fetch(`${BASE}/api/v1/students`, {
    headers: { Cookie: gestorACookie },
  });
  expect(r.status).toBe(200);
  const ids = (await r.json() as Array<{ id: string }>).map((l) => l.id);
  expect(ids).toContain(leitorA.id);
  expect(ids).not.toContain(leitorB.id);
});

// ─── Cenário 3 — Admin vendo tudo ─────────────────────────────────────────────

test("C3: admin acessa /admin/* sem redirect", async () => {
  const r = await fetch(`${BASE}/admin/usuarios`, {
    headers: { Cookie: adminCookie },
    redirect: "manual",
  });
  expect([302, 307]).not.toContain(r.status);
});

test("C3: admin acessa /admin/girotecas sem redirect", async () => {
  const r = await fetch(`${BASE}/admin/girotecas`, {
    headers: { Cookie: adminCookie },
    redirect: "manual",
  });
  expect([302, 307]).not.toContain(r.status);
});

test("C3: admin vê leitores de todas as girotecas", async () => {
  const leitorA = await criarLeitor(girotecaAId);
  const leitorB = await criarLeitor(girotecaBId);
  const r = await fetch(`${BASE}/api/v1/students`, {
    headers: { Cookie: adminCookie },
  });
  expect(r.status).toBe(200);
  const ids = (await r.json() as Array<{ id: string }>).map((l) => l.id);
  expect(ids).toContain(leitorA.id);
  expect(ids).toContain(leitorB.id);
});

// ─── Cenário 4 — Não autenticado ──────────────────────────────────────────────

test("C4: rota de página protegida sem cookie → redirect /login", async () => {
  const r = await fetch(`${BASE}/leitores`, { redirect: "manual" });
  expect([302, 307]).toContain(r.status);
  expect(r.headers.get("location")).toContain("/login");
});

test("C4: rota /admin/* sem cookie → redirect /login", async () => {
  const r = await fetch(`${BASE}/admin/usuarios`, { redirect: "manual" });
  expect([302, 307]).toContain(r.status);
  expect(r.headers.get("location")).toContain("/login");
});

test("C4: GET /login sem cookie → 200 (rota pública)", async () => {
  const r = await fetch(`${BASE}/login`, { redirect: "manual" });
  expect([302, 307]).not.toContain(r.status);
  expect(r.status).toBe(200);
});

test("C4: rota API protegida sem cookie → 401 JSON (não redirect)", async () => {
  const r = await fetch(`${BASE}/api/v1/students`);
  expect(r.status).toBe(401);
  const body = await r.json();
  expect(body.error).toBeDefined();
});

// ─── Cenário 5 — Gestor tentando /admin/* ─────────────────────────────────────

test("C5: gestor acessa /admin/* → redirect para /", async () => {
  const r = await fetch(`${BASE}/admin/usuarios`, {
    headers: { Cookie: gestorACookie },
    redirect: "manual",
  });
  expect([302, 307]).toContain(r.status);
  const location = r.headers.get("location") ?? "";
  // location é URL absoluta: http://localhost:3000/
  expect(location.replace(/^https?:\/\/[^/]+/, "")).toBe("/");
});

// ─── Cenário 6 — Token expirado ───────────────────────────────────────────────

test("C6: cookie com JWT expirado → redirect /login", async () => {
  const expiredToken = jwt.sign(
    { id: "x", papel: "admin_nthe", girotecaId: null },
    process.env.JWT_SECRET!,
    { expiresIn: -1 },
  );
  const r = await fetch(`${BASE}/leitores`, {
    headers: { Cookie: `biblitec_session=${expiredToken}` },
    redirect: "manual",
  });
  expect([302, 307]).toContain(r.status);
  expect(r.headers.get("location")).toContain("/login");
});

// ─── Cenário 7 — Token com assinatura inválida ────────────────────────────────

test("C7: cookie com JWT assinado com segredo errado → redirect /login", async () => {
  const tamperedToken = jwt.sign(
    { id: "hacker", papel: "admin_nthe", girotecaId: null },
    "segredo-errado",
    { expiresIn: "1d" },
  );
  const r = await fetch(`${BASE}/leitores`, {
    headers: { Cookie: `biblitec_session=${tamperedToken}` },
    redirect: "manual",
  });
  expect([302, 307]).toContain(r.status);
  expect(r.headers.get("location")).toContain("/login");
});
