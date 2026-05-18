import {
  criarEmprestimo,
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";
import { db } from "db/index";
import { emprestimos } from "db/schema";
import { eq } from "drizzle-orm";

const BASE = "http://localhost:3000/api/v1/emprestimos";

let cookieGestorA: string;
let girotecaAId: string;
let girotecaBId: string;
let usuarioAId: string;
let usuarioBId: string;

async function login(email: string, senha: string): Promise<string> {
  const res = await fetch("http://localhost:3000/api/v1/sessoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  return res.headers.get("set-cookie")!.split(";")[0].trim();
}

beforeEach(async () => {
  await limparBanco();

  const girotecaA = await criarGiroteca({ codigo: "GA01", nome: "Giroteca A" });
  const girotecaB = await criarGiroteca({ codigo: "GB01", nome: "Giroteca B" });
  girotecaAId = girotecaA.id;
  girotecaBId = girotecaB.id;

  const usuarioA = await criarUsuario({
    email: "gestora@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: girotecaAId,
  });
  const usuarioB = await criarUsuario({
    email: "gestorb@test.com",
    senha: "senha123",
    papel: "gestor_giroteca",
    girotecaId: girotecaBId,
  });
  usuarioAId = usuarioA.id;
  usuarioBId = usuarioB.id;

  cookieGestorA = await login("gestora@test.com", "senha123");
});

test("GET /api/v1/emprestimos sem auth retorna 401", async () => {
  const res = await fetch(`${BASE}?aba=em_aberto`);
  expect(res.status).toBe(401);
});

test("GET /api/v1/emprestimos sem aba retorna 400", async () => {
  const res = await fetch(BASE, { headers: { Cookie: cookieGestorA } });
  expect(res.status).toBe(400);
});

test("GET /api/v1/emprestimos?aba=em_aberto retorna empréstimos em aberto", async () => {
  const livro = await criarLivro({ titulo: "O Alquimista" });
  const exemplar = await criarExemplar(livro.id, girotecaAId);
  const leitor = await criarLeitor(girotecaAId, {
    nome: "Maria Silva",
    turma: "5A",
  });
  await criarEmprestimo(exemplar.id, leitor.id, usuarioAId);

  const res = await fetch(`${BASE}?aba=em_aberto`, {
    headers: { Cookie: cookieGestorA },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.items).toHaveLength(1);
  expect(body.items[0].leitor.nome).toBe("Maria Silva");
  expect(body.items[0].livro.titulo).toBe("O Alquimista");
  expect(body.totalEmAberto).toBe(1);
  expect(body.totalAtrasados).toBeDefined();
});

test("GET /api/v1/emprestimos gestor A não vê empréstimos da giroteca B", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaBId);
  const leitor = await criarLeitor(girotecaBId);
  await criarEmprestimo(exemplar.id, leitor.id, usuarioBId);

  const res = await fetch(`${BASE}?aba=em_aberto`, {
    headers: { Cookie: cookieGestorA },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.items).toHaveLength(0);
});

test("GET /api/v1/emprestimos?aba=atrasados retorna apenas vencidos", async () => {
  const livro = await criarLivro();
  const ex1 = await criarExemplar(livro.id, girotecaAId, {
    codigoTombamento: "TOC-AT-1",
  });
  const ex2 = await criarExemplar(livro.id, girotecaAId, {
    codigoTombamento: "TOC-AT-2",
  });
  const leitor = await criarLeitor(girotecaAId);

  const ontem = new Date();
  ontem.setUTCDate(ontem.getUTCDate() - 1);
  ontem.setUTCHours(0, 0, 0, 0);
  const empAtrasado = await criarEmprestimo(ex1.id, leitor.id, usuarioAId);
  await db
    .update(emprestimos)
    .set({ dataPrevistaDevolucao: ontem })
    .where(eq(emprestimos.id, empAtrasado.id));

  await criarEmprestimo(ex2.id, leitor.id, usuarioAId);

  const res = await fetch(`${BASE}?aba=atrasados`, {
    headers: { Cookie: cookieGestorA },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.items).toHaveLength(1);
  expect(body.items[0].exemplar.codigoTombamento).toBe("TOC-AT-1");
  expect(body.totalAtrasados).toBe(1);
  expect(body.totalEmAberto).toBe(2);
});

test("GET /api/v1/emprestimos?aba=em_aberto&busca= filtra por nome do leitor", async () => {
  const livro = await criarLivro();
  const ex1 = await criarExemplar(livro.id, girotecaAId, {
    codigoTombamento: "TOC-B1",
  });
  const ex2 = await criarExemplar(livro.id, girotecaAId, {
    codigoTombamento: "TOC-B2",
  });
  const leitor1 = await criarLeitor(girotecaAId, {
    nome: "Ana Lima",
    matricula: "MAT-G1",
  });
  const leitor2 = await criarLeitor(girotecaAId, {
    nome: "Pedro Costa",
    matricula: "MAT-G2",
  });
  await criarEmprestimo(ex1.id, leitor1.id, usuarioAId);
  await criarEmprestimo(ex2.id, leitor2.id, usuarioAId);

  const res = await fetch(`${BASE}?aba=em_aberto&busca=ana`, {
    headers: { Cookie: cookieGestorA },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.items).toHaveLength(1);
  expect(body.items[0].leitor.nome).toBe("Ana Lima");
});

test("GET /api/v1/emprestimos?aba=em_aberto&turma= filtra por turma", async () => {
  const livro = await criarLivro();
  const ex1 = await criarExemplar(livro.id, girotecaAId, {
    codigoTombamento: "TOC-T1",
  });
  const ex2 = await criarExemplar(livro.id, girotecaAId, {
    codigoTombamento: "TOC-T2",
  });
  const leitor5A = await criarLeitor(girotecaAId, {
    turma: "5A",
    matricula: "MAT-GT1",
  });
  const leitor6B = await criarLeitor(girotecaAId, {
    turma: "6B",
    matricula: "MAT-GT2",
  });
  await criarEmprestimo(ex1.id, leitor5A.id, usuarioAId);
  await criarEmprestimo(ex2.id, leitor6B.id, usuarioAId);

  const res = await fetch(`${BASE}?aba=em_aberto&turma=5A`, {
    headers: { Cookie: cookieGestorA },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.items).toHaveLength(1);
  expect(body.items[0].leitor.turma).toBe("5A");
});

test("GET /api/v1/emprestimos?aba=historico retorna empréstimos devolvidos", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaAId);
  const leitor = await criarLeitor(girotecaAId);
  const emp = await criarEmprestimo(exemplar.id, leitor.id, usuarioAId);

  await db
    .update(emprestimos)
    .set({ dataDevolucao: new Date() })
    .where(eq(emprestimos.id, emp.id));

  const res = await fetch(`${BASE}?aba=historico`, {
    headers: { Cookie: cookieGestorA },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.items).toHaveLength(1);
  expect(body.items[0].dataDevolucao).not.toBeNull();
  expect(body.total).toBe(1);
});

test("GET /api/v1/emprestimos?aba=historico não retorna em aberto", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaAId);
  const leitor = await criarLeitor(girotecaAId);
  await criarEmprestimo(exemplar.id, leitor.id, usuarioAId);

  const res = await fetch(`${BASE}?aba=historico`, {
    headers: { Cookie: cookieGestorA },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.items).toHaveLength(0);
});

test("GET /api/v1/emprestimos datas retornadas são strings ISO válidas", async () => {
  // Garante que parseDatesItem (cliente) consegue converter os campos de data
  // sem lançar TypeError — o bug original era .toISOString() em string JSON
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaAId);
  const leitor = await criarLeitor(girotecaAId);
  await criarEmprestimo(exemplar.id, leitor.id, usuarioAId);

  const res = await fetch(`${BASE}?aba=em_aberto`, {
    headers: { Cookie: cookieGestorA },
  });

  expect(res.status).toBe(200);
  const body = await res.json();
  const item = body.items[0];

  expect(typeof item.dataEmprestimo).toBe("string");
  expect(new Date(item.dataEmprestimo).toISOString()).toBe(item.dataEmprestimo);

  expect(typeof item.dataPrevistaDevolucao).toBe("string");
  expect(new Date(item.dataPrevistaDevolucao).toISOString()).toBe(
    item.dataPrevistaDevolucao,
  );

  expect(item.dataDevolucao).toBeNull();
});
