import {
  buscarPorTombamento,
  criarParaGiroteca,
  listarPorLivroNaGiroteca,
  mudarStatus,
  sugerirProximoCodigo,
} from "models/exemplares";
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

test("mudarStatus() não pode baixar exemplar emprestado — inclui nome do leitor", async () => {
  const livro = await criarLivro();
  const leitor = await criarLeitor(girotecaA.id, { nome: "João Antônio" });
  const gestorUser = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "A001-011",
    status: "emprestado",
  });
  await criarEmprestimo(exemplar.id, leitor.id, gestorUser.id);

  await expect(
    mudarStatus(exemplar.id, "baixado", "Perdido", ctxGestorA),
  ).rejects.toMatchObject({
    status_code: 409,
    message: expect.stringContaining("João Antônio"),
  });
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

// ─── listarPorLivroNaGiroteca ─────────────────────────────────────────────────

test("listarPorLivroNaGiroteca() gestor vê apenas exemplares da própria giroteca", async () => {
  const livro = await criarLivro();
  const girotecaC = await criarGiroteca({ codigo: "C001", nome: "Giroteca C" });
  await criarExemplar(livro.id, girotecaA.id, { codigoTombamento: "A-001" });
  await criarExemplar(livro.id, girotecaC.id, { codigoTombamento: "C-001" });

  const lista = await listarPorLivroNaGiroteca(livro.id, ctxGestorA);

  expect(lista).toHaveLength(1);
  expect(lista[0].codigoTombamento).toBe("A-001");
});

test("listarPorLivroNaGiroteca() exemplar disponível tem nomeLeitor null", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaA.id, { codigoTombamento: "A-002" });

  const lista = await listarPorLivroNaGiroteca(livro.id, ctxGestorA);

  expect(lista[0].nomeLeitor).toBeNull();
});

test("listarPorLivroNaGiroteca() exemplar emprestado expõe nome do leitor", async () => {
  const livro = await criarLivro();
  const exemplar = await criarExemplar(livro.id, girotecaA.id, {
    codigoTombamento: "A-003",
    status: "emprestado",
  });
  const leitor = await criarLeitor(girotecaA.id, { nome: "Maria das Flores" });
  const gestor = await criarUsuario({
    papel: "gestor_giroteca",
    girotecaId: girotecaA.id,
  });
  await criarEmprestimo(exemplar.id, leitor.id, gestor.id);

  const lista = await listarPorLivroNaGiroteca(livro.id, ctxGestorA);

  expect(lista[0].nomeLeitor).toBe("Maria das Flores");
});

test("listarPorLivroNaGiroteca() admin_nthe vê todas as girotecas", async () => {
  const livro = await criarLivro();
  const girotecaD = await criarGiroteca({ codigo: "D001", nome: "Giroteca D" });
  await criarExemplar(livro.id, girotecaA.id, { codigoTombamento: "A-004" });
  await criarExemplar(livro.id, girotecaD.id, { codigoTombamento: "D-004" });
  const adminUser = await criarUsuario({ papel: "admin_nthe", girotecaId: null });
  const ctxAdmin = {
    usuarioId: adminUser.id,
    papel: "admin_nthe" as const,
    girotecaId: null,
  };

  const lista = await listarPorLivroNaGiroteca(livro.id, ctxAdmin);

  expect(lista).toHaveLength(2);
});

// ─── sugerirProximoCodigo ─────────────────────────────────────────────────────

test("sugerirProximoCodigo() retorna '1' quando não há exemplares", async () => {
  const proximo = await sugerirProximoCodigo(girotecaA.id, ctxGestorA);
  expect(proximo).toBe("1");
});

test("sugerirProximoCodigo() incrementa o maior código numérico", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaA.id, { codigoTombamento: "3" });
  await criarExemplar(livro.id, girotecaA.id, { codigoTombamento: "7" });

  const proximo = await sugerirProximoCodigo(girotecaA.id, ctxGestorA);

  expect(proximo).toBe("8");
});

test("sugerirProximoCodigo() ignora códigos não numéricos", async () => {
  const livro = await criarLivro();
  await criarExemplar(livro.id, girotecaA.id, { codigoTombamento: "ABC-001" });

  const proximo = await sugerirProximoCodigo(girotecaA.id, ctxGestorA);

  expect(proximo).toBe("1");
});

test("sugerirProximoCodigo() gestor não pode sugerir para outra giroteca", async () => {
  await expect(
    sugerirProximoCodigo(girotecaB.id, ctxGestorA),
  ).rejects.toMatchObject({ status_code: 403 });
});
