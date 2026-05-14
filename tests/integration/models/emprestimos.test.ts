import {
  buscarParaDevolucao,
  criar,
  devolver,
  listarAtrasados,
  listarEmAberto,
  renovar,
} from "models/emprestimos";
import type { Contexto } from "lib/auth";
import {
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

let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;
let _ctxAdmin: Contexto;
let ctxGestorA: Contexto;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "EA01", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "EB01", nome: "Giroteca B" });
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  const gestorA = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  _ctxAdmin = { usuarioId: admin.id, papel: "admin_nthe", girotecaId: null };
  ctxGestorA = {
    usuarioId: gestorA.id,
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  };
});

test("criar() cria empréstimo e muda exemplar para emprestado", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);

  const emprestimo = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );

  expect(emprestimo.dataDevolucao).toBeNull();
  expect(emprestimo.renovacoes).toBe(0);

  const { exemplares } = await import("db/schema");
  const [ex] = await db
    .select()
    .from(exemplares)
    .where(eq(exemplares.id, exemplar.id));
  expect(ex.status).toBe("emprestado");
});

test("criar() falha se exemplar não está disponível", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    status: "emprestado",
  });
  const leitor = await criarLeitor(girotecaA.id);

  await expect(
    criar({ exemplarId: exemplar.id, leitorId: leitor.id }, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 409 });
});

test("criar() falha se leitor está inativo", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id, { ativo: false });

  await expect(
    criar({ exemplarId: exemplar.id, leitorId: leitor.id }, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 409 });
});

test("criar() falha se leitor já tem 3 empréstimos em aberto", async () => {
  const leitor = await criarLeitor(girotecaA.id);

  for (let i = 0; i < 3; i++) {
    const livro = await criarLivro();
    const exemplar = await criarExemplar(livro.id, girotecaA.id, {
      codigoTombamento: `TOCX-${i}`,
    });
    await criar({ exemplarId: exemplar.id, leitorId: leitor.id }, ctxGestorA);
  }

  const livroExtra = await criarLivro();
  const exemplarExtra = await criarExemplar(livroExtra.id, girotecaA.id, {
    codigoTombamento: "TOCX-EXTRA",
  });
  await expect(
    criar({ exemplarId: exemplarExtra.id, leitorId: leitor.id }, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 409 });
});

test("criar() falha se leitor tem empréstimo em atraso", async () => {
  const leitor = await criarLeitor(girotecaA.id);
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const empAtrasado = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );
  await db
    .update(emprestimos)
    .set({ dataPrevistaDevolucao: new Date("2000-01-01") })
    .where(eq(emprestimos.id, empAtrasado.id));

  const livro2 = await criarLivro();
  const exemplar2 = await criarExemplar(livro2.id, girotecaA.id, {
    codigoTombamento: "TOC-2",
  });
  await expect(
    criar({ exemplarId: exemplar2.id, leitorId: leitor.id }, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 409 });
});

test("criar() gestor não pode criar empréstimo de outra giroteca", async () => {
  const livro = await criarLivro();
  const exemplarB = await criarExemplar(livro.id, girotecaB.id);
  const leitorB = await criarLeitor(girotecaB.id);

  await expect(
    criar({ exemplarId: exemplarB.id, leitorId: leitorB.id }, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("devolver() registra devolução e libera exemplar", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);
  const emprestimo = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );

  const devolvido = await devolver(emprestimo.id, ctxGestorA);
  expect(devolvido.dataDevolucao).not.toBeNull();

  const { exemplares } = await import("db/schema");
  const [ex] = await db
    .select()
    .from(exemplares)
    .where(eq(exemplares.id, exemplar.id));
  expect(ex.status).toBe("disponivel");
});

test("renovar() estende prazo e incrementa renovacoes", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);
  const emprestimo = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );

  const renovado = await renovar(emprestimo.id, ctxGestorA);
  expect(renovado.renovacoes).toBe(1);
  expect(
    renovado.dataPrevistaDevolucao > emprestimo.dataPrevistaDevolucao,
  ).toBe(true);
});

test("renovar() falha após 2 renovações", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);
  const emprestimo = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );

  await renovar(emprestimo.id, ctxGestorA);
  await renovar(emprestimo.id, ctxGestorA);

  await expect(renovar(emprestimo.id, ctxGestorA)).rejects.toMatchObject({
    status_code: 409,
  });
});

test("renovar() falha se empréstimo está atrasado", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);
  const emprestimo = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );

  await db
    .update(emprestimos)
    .set({ dataPrevistaDevolucao: new Date("2000-01-01") })
    .where(eq(emprestimos.id, emprestimo.id));

  await expect(renovar(emprestimo.id, ctxGestorA)).rejects.toMatchObject({
    status_code: 409,
  });
});

test("listarEmAberto() gestor vê apenas empréstimos da própria giroteca", async () => {
  const livroA = await criarLivro();
  const exemplarA = await criarExemplar(livroA.id, girotecaA.id);
  const leitorA = await criarLeitor(girotecaA.id);
  await criar({ exemplarId: exemplarA.id, leitorId: leitorA.id }, ctxGestorA);

  const livroB = await criarLivro();
  const exemplarB = await criarExemplar(livroB.id, girotecaB.id);
  const leitorB = await criarLeitor(girotecaB.id);
  const ctxGestorB: Contexto = {
    usuarioId: (
      await criarUsuario({ papel: "gestor_giroteca", girotecaId: girotecaB.id })
    ).id,
    papel: "gestor_giroteca",
    girotecaId: girotecaB.id,
  };
  await criar({ exemplarId: exemplarB.id, leitorId: leitorB.id }, ctxGestorB);

  const lista = await listarEmAberto(ctxGestorA);
  expect(lista).toHaveLength(1);
});

test("listarAtrasados() retorna apenas empréstimos em atraso da giroteca", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id);
  const leitor = await criarLeitor(girotecaA.id);
  const emprestimo = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );
  await db
    .update(emprestimos)
    .set({ dataPrevistaDevolucao: new Date("2000-01-01") })
    .where(eq(emprestimos.id, emprestimo.id));

  const atrasados = await listarAtrasados(ctxGestorA);
  expect(atrasados).toHaveLength(1);
});

test("devolver() com estadoRetorno atualiza exemplares.estado", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id); // estado padrão: "bom"
  const leitor = await criarLeitor(girotecaA.id);
  const emp = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );

  await devolver(emp.id, ctxGestorA, { estadoRetorno: "danificado" });

  const { exemplares: exTable } = await import("db/schema");
  const [ex] = await db
    .select()
    .from(exTable)
    .where(eq(exTable.id, exemplar.id));
  expect(ex.status).toBe("disponivel");
  expect(ex.estado).toBe("danificado");
});

test("devolver() sem estadoRetorno não altera exemplares.estado", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id); // estado padrão: "bom"
  const leitor = await criarLeitor(girotecaA.id);
  const emp = await criar(
    { exemplarId: exemplar.id, leitorId: leitor.id },
    ctxGestorA,
  );

  await devolver(emp.id, ctxGestorA);

  const { exemplares: exTable } = await import("db/schema");
  const [ex] = await db
    .select()
    .from(exTable)
    .where(eq(exTable.id, exemplar.id));
  expect(ex.status).toBe("disponivel");
  expect(ex.estado).toBe("bom"); // inalterado
});

test("buscarParaDevolucao() por tombamento com empréstimo ativo retorna dados", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "DEV-TOC-001",
  });
  const leitor = await criarLeitor(girotecaA.id);
  await criar({ exemplarId: exemplar.id, leitorId: leitor.id }, ctxGestorA);

  const resultado = await buscarParaDevolucao("DEV-TOC-001", ctxGestorA);

  expect(resultado.ok).toBe(true);
  if (resultado.ok) {
    expect(resultado.data.exemplar.codigoTombamento).toBe("DEV-TOC-001");
    expect(resultado.data.leitor.nome).toBe("Leitor de Teste");
    expect(resultado.data.livro.titulo).toBe("Livro de Teste");
    expect(resultado.data.emprestimoId).toBeDefined();
    expect(resultado.data.dataEmprestimo).toBeDefined();
    expect(resultado.data.dataPrevistaDevolucao).toBeDefined();
  }
});

test("buscarParaDevolucao() por tombamento disponível retorna SEM_EMPRESTIMO_ABERTO", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "DEV-TOC-002",
    status: "disponivel",
  });

  const resultado = await buscarParaDevolucao("DEV-TOC-002", ctxGestorA);

  expect(resultado).toEqual({ ok: false, code: "SEM_EMPRESTIMO_ABERTO" });
});

test("buscarParaDevolucao() por tombamento baixado retorna EXEMPLAR_BAIXADO", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "DEV-TOC-003",
    status: "baixado",
  });

  const resultado = await buscarParaDevolucao("DEV-TOC-003", ctxGestorA);

  expect(resultado).toEqual({ ok: false, code: "EXEMPLAR_BAIXADO" });
});

test("buscarParaDevolucao() por tombamento inexistente retorna NAO_ENCONTRADO", async () => {
  const resultado = await buscarParaDevolucao(
    "TOMBAMENTO-INEXISTENTE",
    ctxGestorA,
  );

  expect(resultado).toEqual({ ok: false, code: "NAO_ENCONTRADO" });
});

test("buscarParaDevolucao() por tombamento de outra giroteca não vaza existência", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "DEV-TOC-GIROTECA-A",
  });
  const leitor = await criarLeitor(girotecaA.id);
  await criar({ exemplarId: exemplar.id, leitorId: leitor.id }, ctxGestorA);

  const gestorBUsuario = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaB.id,
  });
  const ctxGestorB: Contexto = {
    usuarioId: gestorBUsuario.id,
    papel: "gestor_giroteca",
    girotecaId: girotecaB.id,
  };

  const resultado = await buscarParaDevolucao("DEV-TOC-GIROTECA-A", ctxGestorB);

  expect(resultado).toEqual({ ok: false, code: "NAO_ENCONTRADO" });
});

test("buscarParaDevolucao() por ISBN com 1 exemplar emprestado retorna dados", async () => {
  const livro = await criarLivro({ isbn: "9781111111111" });
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "DEV-ISBN-TOC-1",
  });
  const leitor = await criarLeitor(girotecaA.id);
  await criar({ exemplarId: exemplar.id, leitorId: leitor.id }, ctxGestorA);

  const resultado = await buscarParaDevolucao("9781111111111", ctxGestorA);

  expect(resultado.ok).toBe(true);
  if (resultado.ok) {
    expect(resultado.data.exemplar.codigoTombamento).toBe("DEV-ISBN-TOC-1");
  }
});

test("buscarParaDevolucao() por ISBN com >1 exemplares emprestados retorna MULTIPLOS_EMPRESTADOS", async () => {
  const livro = await criarLivro({ isbn: "9782222222222" });
  const ex1 = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "DEV-ISBN-TOC-2A",
  });
  const ex2 = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "DEV-ISBN-TOC-2B",
  });
  const leitor1 = await criarLeitor(girotecaA.id, { matricula: "DEV-MAT-2A" });
  const leitor2 = await criarLeitor(girotecaA.id, { matricula: "DEV-MAT-2B" });
  await criar({ exemplarId: ex1.id, leitorId: leitor1.id }, ctxGestorA);
  await criar({ exemplarId: ex2.id, leitorId: leitor2.id }, ctxGestorA);

  const resultado = await buscarParaDevolucao("9782222222222", ctxGestorA);

  expect(resultado).toEqual({ ok: false, code: "MULTIPLOS_EMPRESTADOS" });
});
