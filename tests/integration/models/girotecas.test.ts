import { atualizar, criar, listar, listarComContadores } from "models/girotecas";
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

let ctxAdmin: Contexto;
let ctxGestor: Contexto;

beforeEach(async () => {
  await limparBanco();
  const giroteca = await criarGiroteca({ codigo: "G001", nome: "Giroteca G1" });
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  const gestor = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  });
  ctxAdmin = { usuarioId: admin.id, papel: "admin_nthe", girotecaId: null };
  ctxGestor = {
    usuarioId: gestor.id,
    papel: "gestor_giroteca",
    girotecaId: giroteca.id,
  };
});

test("listar() admin vê todas as girotecas", async () => {
  await criarGiroteca({ codigo: "G002", nome: "Outra" });
  const lista = await listar(ctxAdmin);
  expect(lista.length).toBeGreaterThanOrEqual(2);
});

test("listar() gestor vê apenas a própria giroteca", async () => {
  await criarGiroteca({ codigo: "G002", nome: "Outra" });
  const lista = await listar(ctxGestor);
  expect(lista).toHaveLength(1);
  expect(lista[0].id).toBe(ctxGestor.girotecaId);
});

test("criar() admin cria nova giroteca", async () => {
  const g = await criar(
    {
      codigo: "NOVA",
      nome: "Nova Giroteca",
      escolaVinculada: "Escola Nova",
    },
    ctxAdmin,
  );
  expect(g.codigo).toBe("NOVA");
  expect(g.ativa).toBe(true);
});

test("criar() gestor não pode criar giroteca", async () => {
  await expect(
    criar({ codigo: "X", nome: "X", escolaVinculada: "X" }, ctxGestor),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("atualizar() admin atualiza nome da giroteca", async () => {
  const g = await criar(
    { codigo: "UPD", nome: "Original", escolaVinculada: "Escola" },
    ctxAdmin,
  );
  const atualizado = await atualizar(g.id, { nome: "Atualizada" }, ctxAdmin);
  expect(atualizado.nome).toBe("Atualizada");
});

test("atualizar() gestor não pode atualizar giroteca", async () => {
  await expect(
    atualizar(ctxGestor.girotecaId!, { nome: "Novo Nome" }, ctxGestor),
  ).rejects.toMatchObject({ status_code: 403 });
});

// ─── listarComContadores ──────────────────────────────────────────────────────

test("listarComContadores() gestor não autorizado", async () => {
  await expect(
    listarComContadores(ctxGestor),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("listarComContadores() admin vê contadores corretos", async () => {
  const girotecaId = ctxGestor.girotecaId!;
  const livro = await criarLivro();
  const exemplar1 = await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "CNT-001",
  });
  const exemplar2 = await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "CNT-002",
    status: "emprestado",
  });
  const leitor = await criarLeitor(girotecaId);
  await criarEmprestimo(exemplar2.id, leitor.id, ctxGestor.usuarioId);

  const lista = await listarComContadores(ctxAdmin);
  const g = lista.find((x) => x.id === girotecaId)!;

  expect(g.totalExemplares).toBe(2);
  expect(g.totalLeitores).toBe(1);
  expect(g.totalEmprestimosAbertos).toBe(1);
});

test("listarComContadores() empréstimo devolvido não conta como aberto", async () => {
  const girotecaId = ctxGestor.girotecaId!;
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaId, {
    codigoTombamento: "CNT-003",
  });
  const leitor = await criarLeitor(girotecaId);
  await criarEmprestimo(exemplar.id, leitor.id, ctxGestor.usuarioId, {
    dataDevolucao: new Date(),
  });

  const lista = await listarComContadores(ctxAdmin);
  const g = lista.find((x) => x.id === girotecaId)!;

  expect(g.totalEmprestimosAbertos).toBe(0);
});
