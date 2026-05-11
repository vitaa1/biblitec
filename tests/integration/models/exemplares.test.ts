import {
  buscarPorTombamento,
  criarParaGiroteca,
  mudarStatus,
} from "models/exemplares";
import type { Contexto } from "lib/auth";
import {
  criarExemplar,
  criarGiroteca,
  criarLivro,
  criarUsuario,
  limparBanco,
} from "tests/factories";

let girotecaA: Awaited<ReturnType<typeof criarGiroteca>>;
let girotecaB: Awaited<ReturnType<typeof criarGiroteca>>;
let ctxGestorA: Contexto;

beforeEach(async () => {
  await limparBanco();
  girotecaA = await criarGiroteca({ codigo: "A001", nome: "Giroteca A" });
  girotecaB = await criarGiroteca({ codigo: "B001", nome: "Giroteca B" });
  const gestorA = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  ctxGestorA = {
    usuarioId: gestorA.id,
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  };
});

test("criarParaGiroteca() gestor cria exemplar na própria giroteca", async () => {
  const livro = await criarLivro();
  const exemplar = await criarParaGiroteca(
    {
      livroId: livro.id,
      girotecaId: girotecaA.id,
      codigoTombamento: "A001-001",
    },
    ctxGestorA,
  );
  expect(exemplar.girotecaId).toBe(girotecaA.id);
  expect(exemplar.status).toBe("disponivel");
});

test("criarParaGiroteca() gestor não pode criar em outra giroteca", async () => {
  const livro = await criarLivro();
  await expect(
    criarParaGiroteca(
      {
        livroId: livro.id,
        girotecaId: girotecaB.id,
        codigoTombamento: "B001-001",
      },
      ctxGestorA,
    ),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("buscarPorTombamento() retorna exemplar da própria giroteca", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "A001-042",
  });
  const encontrado = await buscarPorTombamento(
    "A001-042",
    girotecaA.id,
    ctxGestorA,
  );
  expect(encontrado).not.toBeNull();
  expect(encontrado!.codigoTombamento).toBe("A001-042");
});

test("buscarPorTombamento() gestor não pode ver exemplar de outra giroteca", async () => {
  await expect(
    buscarPorTombamento("B001-001", girotecaB.id, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 403 });
});

test("mudarStatus() baixa exemplar disponível", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "A001-010",
  });
  const atualizado = await mudarStatus(
    exemplar.id,
    "baixado",
    "Perdido",
    ctxGestorA,
  );
  expect(atualizado.status).toBe("baixado");
});

test("mudarStatus() não pode baixar exemplar emprestado", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "A001-011",
    status: "emprestado",
  });
  await expect(
    mudarStatus(exemplar.id, "baixado", "Perdido", ctxGestorA),
  ).rejects.toMatchObject({ status_code: 409 });
});

test("mudarStatus() gestor não pode alterar exemplar de outra giroteca", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaB.id, {
    codigoTombamento: "B001-001",
  });
  await expect(
    mudarStatus(exemplar.id, "baixado", "Perdido", ctxGestorA),
  ).rejects.toMatchObject({ status_code: 403 });
});
