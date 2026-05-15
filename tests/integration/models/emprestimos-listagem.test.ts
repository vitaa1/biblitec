import { listarComFiltros, listarHistorico } from "models/emprestimos";
import type { Contexto } from "lib/auth";
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
import { emprestimos, exemplares } from "db/schema";
import { eq } from "drizzle-orm";

let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;
let ctxGestorA: Contexto;
let ctxGestorB: Contexto;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "LA01", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "LB01", nome: "Giroteca B" });

  const usuarioA = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  ctxGestorA = {
    usuarioId: usuarioA.id,
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  };

  const usuarioB = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaB.id,
  });
  ctxGestorB = {
    usuarioId: usuarioB.id,
    papel: "gestor_giroteca",
    girotecaId: girotecaB.id,
  };
});

// ─── listarComFiltros ───────────────────────────────────────────────

test("listarComFiltros() em_aberto retorna empréstimos da giroteca com dados do leitor e livro", async () => {
  const livro = await criarLivro({ titulo: "Dom Casmurro" });
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id, {
    nome: "João Silva",
    turma: "5A",
  });
  await criarEmprestimo(exemplar.id, leitor.id, ctxGestorA.usuarioId);

  const resultado = await listarComFiltros({ aba: "em_aberto" }, ctxGestorA);

  expect(resultado.items).toHaveLength(1);
  expect(resultado.items[0].leitor.nome).toBe("João Silva");
  expect(resultado.items[0].livro.titulo).toBe("Dom Casmurro");
  expect(resultado.items[0].dataDevolucao).toBeNull();
  expect(resultado.totalEmAberto).toBe(1);
});

test("listarComFiltros() gestor A não vê empréstimos da giroteca B", async () => {
  const livroB = await criarLivro();
  const exemplarB = await criarExemplar(livroB.id, girotecaB.id);
  const leitorB = await criarLeitor(girotecaB.id);
  await criarEmprestimo(exemplarB.id, leitorB.id, ctxGestorB.usuarioId);

  const resultado = await listarComFiltros({ aba: "em_aberto" }, ctxGestorA);

  expect(resultado.items).toHaveLength(0);
  expect(resultado.totalEmAberto).toBe(0);
});

test("listarComFiltros() atrasados retorna apenas empréstimos vencidos antes de hoje", async () => {
  const livro = await criarLivro();
  const exemplar1 = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "TOC-ATR-1",
  });
  const exemplar2 = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "TOC-ATR-2",
  });
  const leitor = await criarLeitor(girotecaA.id);

  // Atrasado: venceu ontem
  const ontem = new Date();
  ontem.setUTCDate(ontem.getUTCDate() - 1);
  ontem.setUTCHours(0, 0, 0, 0);
  await criarEmprestimo(exemplar1.id, leitor.id, ctxGestorA.usuarioId, {
    dataPrevistaDevolucao: ontem,
  });

  // Não atrasado: vence hoje
  const hoje = new Date();
  hoje.setUTCHours(23, 59, 59, 0);
  await criarEmprestimo(exemplar2.id, leitor.id, ctxGestorA.usuarioId, {
    dataPrevistaDevolucao: hoje,
  });

  const resultado = await listarComFiltros({ aba: "atrasados" }, ctxGestorA);

  expect(resultado.items).toHaveLength(1);
  expect(resultado.items[0].exemplar.codigoTombamento).toBe("TOC-ATR-1");
  expect(resultado.totalAtrasados).toBe(1);
});

test("listarComFiltros() vence hoje não é atrasado", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);
  const hoje = new Date();
  hoje.setUTCHours(23, 59, 59, 0);
  await criarEmprestimo(exemplar.id, leitor.id, ctxGestorA.usuarioId, {
    dataPrevistaDevolucao: hoje,
  });

  const resultado = await listarComFiltros({ aba: "atrasados" }, ctxGestorA);

  expect(resultado.items).toHaveLength(0);
  expect(resultado.totalAtrasados).toBe(0);
});

test("listarComFiltros() filtra por busca (nome do leitor, case-insensitive)", async () => {
  const livro = await criarLivro();
  const ex1 = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "TOC-BUSCA-1",
  });
  const ex2 = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "TOC-BUSCA-2",
  });
  const leitor1 = await criarLeitor(girotecaA.id, {
    nome: "Maria Oliveira",
    matricula: "MAT-B1",
  });
  const leitor2 = await criarLeitor(girotecaA.id, {
    nome: "Pedro Santos",
    matricula: "MAT-B2",
  });
  await criarEmprestimo(ex1.id, leitor1.id, ctxGestorA.usuarioId);
  await criarEmprestimo(ex2.id, leitor2.id, ctxGestorA.usuarioId);

  const resultado = await listarComFiltros(
    { aba: "em_aberto", busca: "maria" },
    ctxGestorA,
  );

  expect(resultado.items).toHaveLength(1);
  expect(resultado.items[0].leitor.nome).toBe("Maria Oliveira");
});

test("listarComFiltros() filtra por turma", async () => {
  const livro = await criarLivro();
  const ex1 = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "TOC-TURMA-1",
  });
  const ex2 = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "TOC-TURMA-2",
  });
  const leitor5A = await criarLeitor(girotecaA.id, {
    turma: "5A",
    matricula: "MAT-T1",
  });
  const leitor6B = await criarLeitor(girotecaA.id, {
    turma: "6B",
    matricula: "MAT-T2",
  });
  await criarEmprestimo(ex1.id, leitor5A.id, ctxGestorA.usuarioId);
  await criarEmprestimo(ex2.id, leitor6B.id, ctxGestorA.usuarioId);

  const resultado = await listarComFiltros(
    { aba: "em_aberto", turma: "5A" },
    ctxGestorA,
  );

  expect(resultado.items).toHaveLength(1);
  expect(resultado.items[0].leitor.turma).toBe("5A");
});

test("listarComFiltros() filtra por busca + turma combinados (AND)", async () => {
  const livro = await criarLivro();
  const ex1 = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "TOC-AND-1",
  });
  const ex2 = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "TOC-AND-2",
  });
  const leitorMatch = await criarLeitor(girotecaA.id, {
    nome: "Ana Costa",
    turma: "5A",
    matricula: "MAT-AND-1",
  });
  const leitorNoMatch = await criarLeitor(girotecaA.id, {
    nome: "Ana Lima",
    turma: "6B",
    matricula: "MAT-AND-2",
  });
  await criarEmprestimo(ex1.id, leitorMatch.id, ctxGestorA.usuarioId);
  await criarEmprestimo(ex2.id, leitorNoMatch.id, ctxGestorA.usuarioId);

  const resultado = await listarComFiltros(
    { aba: "em_aberto", busca: "ana", turma: "5A" },
    ctxGestorA,
  );

  expect(resultado.items).toHaveLength(1);
  expect(resultado.items[0].leitor.nome).toBe("Ana Costa");
});

test("listarComFiltros() totalAtrasados reflete contagem correta mesmo na aba em_aberto", async () => {
  const livro = await criarLivro();
  const ex1 = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "TOC-COUNT-1",
  });
  const ex2 = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "TOC-COUNT-2",
  });
  const leitor = await criarLeitor(girotecaA.id);

  const ontem = new Date();
  ontem.setUTCDate(ontem.getUTCDate() - 1);
  ontem.setUTCHours(0, 0, 0, 0);
  await criarEmprestimo(ex1.id, leitor.id, ctxGestorA.usuarioId, {
    dataPrevistaDevolucao: ontem,
  });
  await criarEmprestimo(ex2.id, leitor.id, ctxGestorA.usuarioId);

  const resultado = await listarComFiltros({ aba: "em_aberto" }, ctxGestorA);

  expect(resultado.totalEmAberto).toBe(2);
  expect(resultado.totalAtrasados).toBe(1);
});

// ─── listarHistorico ─────────────────────────────────────────────────

test("listarHistorico() retorna apenas empréstimos devolvidos da giroteca", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);
  const emp = await criarEmprestimo(
    exemplar.id,
    leitor.id,
    ctxGestorA.usuarioId,
  );

  // Marcar como devolvido
  await db
    .update(emprestimos)
    .set({ dataDevolucao: new Date() })
    .where(eq(emprestimos.id, emp.id));
  // Liberar exemplar
  await db
    .update(exemplares)
    .set({ status: "disponivel" })
    .where(eq(exemplares.id, exemplar.id));

  const resultado = await listarHistorico({}, ctxGestorA);

  expect(resultado.items).toHaveLength(1);
  expect(resultado.items[0].dataDevolucao).not.toBeNull();
});

test("listarHistorico() gestor A não vê histórico da giroteca B", async () => {
  const livroB = await criarLivro();
  const exemplarB = await criarExemplar(livroB.id, girotecaB.id);
  const leitorB = await criarLeitor(girotecaB.id);
  const empB = await criarEmprestimo(
    exemplarB.id,
    leitorB.id,
    ctxGestorB.usuarioId,
  );
  await db
    .update(emprestimos)
    .set({ dataDevolucao: new Date() })
    .where(eq(emprestimos.id, empB.id));

  const resultado = await listarHistorico({}, ctxGestorA);

  expect(resultado.items).toHaveLength(0);
});

test("listarHistorico() não retorna empréstimos em aberto", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);
  await criarEmprestimo(exemplar.id, leitor.id, ctxGestorA.usuarioId);

  const resultado = await listarHistorico({}, ctxGestorA);

  expect(resultado.items).toHaveLength(0);
});
