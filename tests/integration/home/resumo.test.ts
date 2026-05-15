import { contarResumoEmprestimos } from "models/emprestimos";
import type { Contexto } from "lib/auth";
import {
  criarExemplar,
  criarGiroteca,
  criarLeitor,
  criarLivro,
  criarUsuario,
  criarEmprestimo,
  limparBanco,
} from "tests/factories";

let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;
let ctxAdmin: Contexto;
let ctxGestorA: Contexto;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "HA01", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "HB01", nome: "Giroteca B" });
  const admin = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  const gestorA = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  ctxAdmin = { usuarioId: admin.id, papel: "admin_nthe", girotecaId: null };
  ctxGestorA = {
    usuarioId: gestorA.id,
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  };
});

async function criarEmprestimoNaGiroteca(
  girotecaId: string,
  usuarioId: string,
  override: Parameters<typeof criarEmprestimo>[3] = {},
) {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaId);
  const leitor = await criarLeitor(girotecaId);
  return criarEmprestimo(exemplar.id, leitor.id, usuarioId, override);
}

test("banco vazio: emAberto=0, atrasados=0", async () => {
  const resultado = await contarResumoEmprestimos(ctxAdmin);
  expect(resultado.emAberto).toBe(0);
  expect(resultado.atrasados).toBe(0);
});

test("admin vê soma de todas as girotecas", async () => {
  await criarEmprestimoNaGiroteca(girotecaA.id, ctxAdmin.usuarioId);
  await criarEmprestimoNaGiroteca(girotecaB.id, ctxAdmin.usuarioId);

  const resultado = await contarResumoEmprestimos(ctxAdmin);
  expect(resultado.emAberto).toBe(2);
});

test("gestor vê apenas sua giroteca", async () => {
  await criarEmprestimoNaGiroteca(girotecaA.id, ctxAdmin.usuarioId);
  await criarEmprestimoNaGiroteca(girotecaB.id, ctxAdmin.usuarioId);

  const resultado = await contarResumoEmprestimos(ctxGestorA);
  expect(resultado.emAberto).toBe(1);
});

test("empréstimo devolvido não entra em emAberto nem em atrasados", async () => {
  await criarEmprestimoNaGiroteca(girotecaA.id, ctxAdmin.usuarioId, {
    dataDevolucao: new Date(),
  });

  const resultado = await contarResumoEmprestimos(ctxGestorA);
  expect(resultado.emAberto).toBe(0);
  expect(resultado.atrasados).toBe(0);
});

test("empréstimo no prazo conta em emAberto mas não em atrasados", async () => {
  const futuro = new Date(Date.UTC(2099, 0, 1));
  await criarEmprestimoNaGiroteca(girotecaA.id, ctxAdmin.usuarioId, {
    dataPrevistaDevolucao: futuro,
  });

  const resultado = await contarResumoEmprestimos(ctxGestorA);
  expect(resultado.emAberto).toBe(1);
  expect(resultado.atrasados).toBe(0);
});

test("empréstimo atrasado conta em emAberto E em atrasados", async () => {
  const passado = new Date(Date.UTC(2000, 0, 1));
  await criarEmprestimoNaGiroteca(girotecaA.id, ctxAdmin.usuarioId, {
    dataPrevistaDevolucao: passado,
  });

  const resultado = await contarResumoEmprestimos(ctxGestorA);
  expect(resultado.emAberto).toBe(1);
  expect(resultado.atrasados).toBe(1);
});

test("gestor de giroteca B não vê empréstimos da giroteca A", async () => {
  await criarEmprestimoNaGiroteca(girotecaA.id, ctxAdmin.usuarioId);

  const gestorB = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaB.id,
  });
  const ctxGestorB: Contexto = {
    usuarioId: gestorB.id,
    papel: "gestor_giroteca",
    girotecaId: girotecaB.id,
  };

  const resultado = await contarResumoEmprestimos(ctxGestorB);
  expect(resultado.emAberto).toBe(0);
});
