import { atualizar, criar, listar } from "models/girotecas";
import type { Contexto } from "lib/auth";
import { criarGiroteca, criarUsuario, limparBanco } from "tests/factories";

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
    criar(
      { codigo: "X", nome: "X", escolaVinculada: "X" },
      ctxGestor,
    ),
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
