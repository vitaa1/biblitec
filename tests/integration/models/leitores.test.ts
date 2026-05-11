import { atualizar, buscar, criar, desativar } from "models/leitores";
import type { Contexto } from "lib/auth";
import {
  criarGiroteca,
  criarLeitor,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;
let ctxAdmin: Contexto;
let ctxGestorA: Contexto;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "LA01", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "LB01", nome: "Giroteca B" });
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

test("buscar() gestor vê leitores da própria giroteca", async () => {
  await criarLeitor(girotecaA.id, { nome: "Ana Silva" });
  await criarLeitor(girotecaB.id, { nome: "João Sousa" });
  const lista = await buscar({}, ctxGestorA);
  expect(lista).toHaveLength(1);
  expect(lista[0].nome).toBe("Ana Silva");
});

test("buscar() admin vê leitores de todas as girotecas", async () => {
  await criarLeitor(girotecaA.id);
  await criarLeitor(girotecaB.id);
  const lista = await buscar({}, ctxAdmin);
  expect(lista).toHaveLength(2);
});

test("buscar() filtra por nome", async () => {
  await criarLeitor(girotecaA.id, { nome: "Ana Silva" });
  await criarLeitor(girotecaA.id, {
    nome: "Carlos Sousa",
    matricula: "MAT-999",
  });
  const lista = await buscar({ busca: "Ana" }, ctxGestorA);
  expect(lista).toHaveLength(1);
  expect(lista[0].nome).toBe("Ana Silva");
});

test("criar() cria leitor na giroteca do gestor", async () => {
  const leitor = await criar(
    {
      girotecaId: girotecaA.id,
      nome: "Maria Souza",
      matricula: "2024-001",
      tipo: "aluno",
    },
    ctxGestorA,
  );
  expect(leitor.girotecaId).toBe(girotecaA.id);
  expect(leitor.ativo).toBe(true);
});

test("criar() gestor não pode criar leitor em outra giroteca", async () => {
  await expect(
    criar(
      {
        girotecaId: girotecaB.id,
        nome: "Fulano",
        matricula: "2024-002",
      },
      ctxGestorA,
    ),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("atualizar() atualiza nome do leitor", async () => {
  const leitor = await criarLeitor(girotecaA.id, { nome: "Antigo Nome" });
  const atualizado = await atualizar(
    leitor.id,
    { nome: "Novo Nome" },
    ctxGestorA,
  );
  expect(atualizado.nome).toBe("Novo Nome");
});

test("atualizar() gestor não pode atualizar leitor de outra giroteca", async () => {
  const leitor = await criarLeitor(girotecaB.id);
  await expect(
    atualizar(leitor.id, { nome: "Hackeado" }, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("desativar() marca leitor como inativo", async () => {
  const leitor = await criarLeitor(girotecaA.id);
  const desativado = await desativar(leitor.id, ctxGestorA);
  expect(desativado.ativo).toBe(false);
});

test("desativar() gestor não pode desativar leitor de outra giroteca", async () => {
  const leitor = await criarLeitor(girotecaB.id);
  await expect(desativar(leitor.id, ctxGestorA)).rejects.toMatchObject({
    status_code: 403,
  });
});
